'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { AddProjectDialog } from "@/components/common/add-project-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import type { Company, Project, Task } from "@/lib/types";
import { collection, doc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Archive, ArchiveRestore, MoreVertical, Trash2, LayoutGrid, List, Zap, Plus } from "lucide-react";
import { EditProjectDialog } from "@/components/common/edit-project-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { addQuickTask } from "@/lib/tasks";
import { TaskItem } from "@/components/common/task-item";

function CompanyBreadcrumb({ companyName }: { companyName?: string }) {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/companies">Companies</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">
            {companyName || <Skeleton className="h-5 w-24" />}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function QuickTaskSection({ companyId }: { companyId: string }) {
    const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch quick tasks (from the general project)
    const quickTasksQuery = useMemoFirebase(() => {
        if (!selectedWorkspace) return null;
        return collection(firestore, `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/general-tasks/silos/inbox/tasks`);
    }, [firestore, selectedWorkspace, companyId]);

    const { data: tasks, isLoading } = useCollection<Task>(quickTasksQuery);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !user || !selectedWorkspace) return;

        setIsSubmitting(true);
        try {
            await addQuickTask(firestore, {
                workspaceId: selectedWorkspace.id,
                companyId,
                taskData: {
                    title: title.trim(),
                    completed: false,
                    dueDate: new Date().toISOString(),
                    priority: 'medium',
                    assigneeId: user.uid,
                    createdBy: user.uid,
                }
            });
            setTitle('');
            toast({ title: "Quick Task Added", description: "Task created in General Tasks." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Failed to add task", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeQuickTasks = tasks?.filter(t => !t.completed) || [];

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary">
                    <Zap className="h-5 w-5 fill-current" />
                    <CardTitle className="text-lg">Quick Tasks</CardTitle>
                </div>
                <CardDescription>Rapidly add tasks that aren't linked to a specific project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form onSubmit={handleAdd} className="flex gap-2">
                    <Input 
                        placeholder="What needs to happen?" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isSubmitting}
                        className="bg-background"
                    />
                    <Button type="submit" disabled={isSubmitting || !title.trim()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                    </Button>
                </form>

                {activeQuickTasks.length > 0 && (
                    <div className="space-y-1 bg-background/50 rounded-md border p-1">
                        {activeQuickTasks.map(task => (
                            <TaskItem 
                                key={task.id} 
                                task={task} 
                                siloId="inbox" 
                                path={`workspaces/${selectedWorkspace?.id}/companies/${companyId}/projects/general-tasks/silos/inbox/tasks/${task.id}`} 
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function NoProjectsView({ companyId, filter }: { companyId: string, filter: string }) {
  const { isUserAdmin } = useSelectedWorkspace();
  return (
    <div className="text-center border-2 border-dashed border-muted rounded-lg p-12">
        <h2 className="text-xl font-semibold">No {filter} projects</h2>
        <p className="text-muted-foreground mt-2 mb-4">There are no projects with this status in the company.</p>
        {filter === 'active' && (
            isUserAdmin ? (
                <AddProjectDialog companyId={companyId}>
                    <Button>Add Project</Button>
                </AddProjectDialog>
            ) : (
                <p className="text-sm text-muted-foreground">You do not have permission to add projects.</p>
            )
        )}
    </div>
  )
}

function ProjectActions({ project, companyId }: { project: Project, companyId: string }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { selectedWorkspace } = useSelectedWorkspace();

    const handleDelete = async () => {
        if (!selectedWorkspace) return;
        const projectRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', project.id);
        try {
            await deleteDoc(projectRef);
            toast({
                title: "Project Deleted",
                description: `"${project.name}" has been deleted.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Error Deleting Project",
                description: error.message,
            });
        }
    };

    const handleArchive = async () => {
        if (!selectedWorkspace) return;
        const projectRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', project.id);
        try {
            await updateDoc(projectRef, { status: 'archived' });
            toast({
                title: "Project Archived",
                description: `"${project.name}" has been moved to archives.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Error Archiving Project",
                description: error.message,
            });
        }
    };

    const handleRestore = async () => {
        if (!selectedWorkspace) return;
        const projectRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', project.id);
        try {
            await updateDoc(projectRef, { status: project.progress === 100 ? 'completed' : 'active' });
            toast({
                title: "Project Restored",
                description: `"${project.name}" has been restored.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Error Restoring Project",
                description: error.message,
            });
        }
    };
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                    <EditProjectDialog project={project} companyId={companyId}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </EditProjectDialog>
                {project.status === 'archived' ? (
                    <DropdownMenuItem onClick={handleRestore}>
                        <ArchiveRestore className="mr-2 h-4 w-4" />
                        Restore
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem onClick={handleArchive}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DeleteDialog onConfirm={handleDelete} itemName={project.name}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Delete
                    </DropdownMenuItem>
                </DeleteDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ProjectsList({ companyId }: { companyId: string }) {
    const { isUserAdmin, selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    const [filter, setFilter] = useState<'active' | 'completed' | 'archived'>('active');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    
    const projectsQuery = useMemoFirebase(() => {
        if (!selectedWorkspace) return null;
        return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects');
    }, [firestore, selectedWorkspace, companyId]);

    const { data: allProjects, isLoading } = useCollection<Project>(projectsQuery);

    const filteredProjects = useMemo(() => {
        if (!allProjects) return [];
        return allProjects.filter(project => {
            // Hide the internal "general-tasks" project from the main projects list
            if (project.id === 'general-tasks') return false;
            const status = project.status || 'active';
            return status === filter;
        });
    }, [allProjects, filter]);

    if (isLoading) {
        return (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <TabsList>
                    <TabsTrigger value="active">Active Projects</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                    <TabsTrigger value="archived">Archived</TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-muted p-1 rounded-md">
                        <Button
                            size="sm"
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('grid')}
                            className="h-8 w-8 p-0"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('list')}
                            className="h-8 w-8 p-0"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    {isUserAdmin && <AddProjectDialog companyId={companyId} />}
                </div>
            </div>

            <TabsContent value={filter}>
                {filteredProjects.length === 0 ? (
                    <NoProjectsView companyId={companyId} filter={filter} />
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {filteredProjects.map(project => (
                                    <Card key={project.id} className="flex flex-col relative">
                                        <div className="absolute top-2 right-2">
                                            {isUserAdmin && <ProjectActions project={project} companyId={companyId} />}
                                        </div>
                                        <CardHeader>
                                            <CardTitle className="flex justify-between items-start pr-8">
                                                <Link href={`/company/${companyId}/project/${project.id}`} className="hover:underline text-xl">
                                                    {project.name}
                                                </Link>
                                                {project.hasMonetaryValue && project.monetaryValue && (
                                                    <span className="text-lg font-semibold text-green-500">
                                                        R{project.monetaryValue.toLocaleString()}
                                                    </span>
                                                )}
                                            </CardTitle>
                                            <CardDescription>
                                                Deadline: {project.deadline ? format(new Date(project.deadline), 'PPP') : 'No deadline'}
                                                {project.status === 'completed' && project.completedAt &&
                                                    ` • Completed: ${format((project.completedAt as Timestamp).toDate(), 'PPP')}`
                                                }
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-grow">
                                        </CardContent>
                                        <CardFooter className="flex-col items-start gap-4">
                                            <div className="w-full space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-muted-foreground">Progress</span>
                                                    <span className="text-sm font-medium">{project.progress || 0}%</span>
                                                </div>
                                                <Progress value={project.progress || 0} />
                                            </div>
                                            <Button variant="outline" className="w-full" asChild>
                                                <Link href={`/company/${companyId}/project/${project.id}`}>View Project</Link>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="border rounded-md bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Project</TableHead>
                                            <TableHead>Deadline</TableHead>
                                            <TableHead className="w-[25%]">Progress</TableHead>
                                            <TableHead className="text-right">Value</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProjects.map((project) => (
                                            <TableRow key={project.id}>
                                                <TableCell className="font-medium">
                                                    <Link href={`/company/${companyId}/project/${project.id}`} className="hover:underline">
                                                        {project.name}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                                    {project.deadline ? format(new Date(project.deadline), 'MMM d, yyyy') : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Progress value={project.progress || 0} className="h-2" />
                                                        <span className="text-xs font-medium tabular-nums w-8">{project.progress || 0}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {project.hasMonetaryValue && project.monetaryValue 
                                                        ? `R${project.monetaryValue.toLocaleString()}` 
                                                        : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {isUserAdmin && <ProjectActions project={project} companyId={companyId} />}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </>
                )}
            </TabsContent>
        </Tabs>
    )
}

export default function CompanyPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const companyRef = useMemoFirebase(() => {
    if (!selectedWorkspace || !companyId) return null;
    return doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId);
  }, [firestore, selectedWorkspace, companyId]);

  const { data: company, isLoading } = useDoc<Company>(companyRef);

  if (isLoading || !company) {
    return (
        <div className="space-y-6">
            <CompanyBreadcrumb />
            <Skeleton className="h-10 w-1/2 mt-4" />
            <Skeleton className="h-5 w-3/4" />
            <div className="mt-8">
                 <Skeleton className="h-40 w-full" />
            </div>
        </div>
    )
  }
  
  return (
    <div className="space-y-8">
       <CompanyBreadcrumb companyName={company.name} />
      <div>
        <h1 className="text-4xl font-headline font-bold">{company.name}</h1>
        <p className="text-lg text-muted-foreground mt-2">{company.description}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <ProjectsList companyId={company.id} />
          </div>
          <div className="lg:col-span-1 order-1 lg:order-2">
            <QuickTaskSection companyId={company.id} />
          </div>
      </div>
    </div>
  );
}
