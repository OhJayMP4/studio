'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { AddProjectDialog } from "@/components/common/add-project-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import type { Company, Project } from "@/lib/types";
import { collection, doc, deleteDoc } from "firebase/firestore";
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { EditProjectDialog } from "@/components/common/edit-project-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useToast } from "@/hooks/use-toast";

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


function NoProjectsView({ companyId }: { companyId: string }) {
  const { isUserAdmin } = useSelectedWorkspace();
  return (
    <div className="text-center border-2 border-dashed border-muted rounded-lg p-12">
        <h2 className="text-xl font-semibold">No Projects Found</h2>
        <p className="text-muted-foreground mt-2 mb-4">Get started by adding your first project to this company.</p>
        {isUserAdmin ? (
            <AddProjectDialog companyId={companyId}>
                <Button>Add Project</Button>
            </AddProjectDialog>
        ) : (
            <p className="text-sm text-muted-foreground">You do not have permission to add projects.</p>
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

    return (
        <div className="absolute top-2 right-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                     <EditProjectDialog project={project} companyId={companyId}>
                         <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            Edit
                        </DropdownMenuItem>
                    </EditProjectDialog>
                    <DeleteDialog onConfirm={handleDelete} itemName={project.name}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                            Delete
                        </DropdownMenuItem>
                    </DeleteDialog>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function ProjectsList({ companyId }: { companyId: string }) {
    const { isUserAdmin, selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    
    const projectsQuery = useMemoFirebase(() => {
        if (!selectedWorkspace) return null;
        return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects');
    }, [firestore, selectedWorkspace, companyId]);

    const { data: projects, isLoading } = useCollection<Project>(projectsQuery);

    if (isLoading) {
        return (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-4 w-full" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-4 w-full" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-4 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!projects || projects.length === 0) {
        return <NoProjectsView companyId={companyId} />;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-headline">Projects</h2>
                {isUserAdmin && <AddProjectDialog companyId={companyId} />}
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.map(project => (
                    <Card key={project.id} className="flex flex-col relative">
                        {isUserAdmin && <ProjectActions project={project} companyId={companyId} />}
                        <CardHeader>
                            <CardTitle className="flex justify-between items-start pr-8">
                                <Link href={`/company/${companyId}/project/${project.id}`} className="hover:underline">
                                    {project.name}
                                </Link>
                                {project.hasMonetaryValue && project.monetaryValue && (
                                    <span className="text-lg font-semibold text-green-500">
                                        R{project.monetaryValue.toLocaleString()}
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription>
                                Deadline: {format(new Date(project.deadline), 'PPP')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            {/* Content can go here if needed in the future */}
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-4">
                             <div className="w-full space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Progress</span>
                                    <span className="text-sm font-medium">{project.progress}%</span>
                                </div>
                                <Progress value={project.progress} />
                            </div>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href={`/company/${companyId}/project/${project.id}`}>View Project</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
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
    <div className="space-y-6">
       <CompanyBreadcrumb companyName={company.name} />
      <div className="mt-4">
        <h1 className="text-4xl font-headline font-bold">{company.name}</h1>
        <p className="text-lg text-muted-foreground mt-2">{company.description}</p>
      </div>
      <div className="mt-8">
        <ProjectsList companyId={company.id} />
      </div>
    </div>
  );
}
