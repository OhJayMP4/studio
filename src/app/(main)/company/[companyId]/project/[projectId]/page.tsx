'use client';

import { useSelectedWorkspace } from '@/app/(main)/layout';
import { AddSiloDialog } from '@/components/common/add-silo-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { Company, Project, Sale, Silo, Task } from '@/lib/types';
import { collection, doc, query, orderBy, getDocs, runTransaction, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { AddTaskDialog } from '@/components/common/add-task-dialog';
import { TaskItem } from '@/components/common/task-item';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddSaleDialog } from '@/components/common/add-sale-dialog';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect }from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EditSiloDialog } from '@/components/common/edit-silo-dialog';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { useToast } from '@/hooks/use-toast';


async function updateProjectProgress(firestore: any, workspaceId: string, companyId: string, projectId: string) {
    const projectRef = doc(firestore, 'workspaces', workspaceId, 'companies', companyId, 'projects', projectId);

    // Perform reads outside of the transaction
    const silosCollection = collection(projectRef, 'silos');
    const silosSnapshot = await getDocs(silosCollection);
    let totalTasks = 0;
    let completedTasks = 0;

    for (const siloDoc of silosSnapshot.docs) {
        const tasksCollection = collection(siloDoc.ref, 'tasks');
        const tasksSnapshot = await getDocs(tasksCollection);
        totalTasks += tasksSnapshot.size;
        tasksSnapshot.forEach(taskDoc => {
            if (taskDoc.data().completed) {
                completedTasks++;
            }
        });
    }

    // Now run the transaction to read the project and update it atomically
    await runTransaction(firestore, async (transaction) => {
        const projectDoc = await transaction.get(projectRef);
        if (!projectDoc.exists()) {
            throw "Project not found!";
        }
        const projectData = projectDoc.data() as Project;

        const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
        
        // Use existing sales data from the project doc
        const salesTarget = projectData.monetaryValue || 0;
        const currentSales = projectData.totalSalesValue || 0;
        const salesProgress = salesTarget > 0 ? Math.min(currentSales / salesTarget, 1) : 0;

        const overallProgress = projectData.hasMonetaryValue 
            ? (salesProgress * 0.5 + taskProgress * 0.5) * 100
            : taskProgress * 100;

        transaction.update(projectRef, { progress: Math.round(overallProgress) });
    });
}

function ProjectBreadcrumb({
  company,
  projectName,
}: {
  company?: Company;
  projectName?: string;
}) {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            {company ? (
              <Link href={`/company/${company.id}`}>{company.name}</Link>
            ) : (
              <Skeleton className="h-5 w-24" />
            )}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">
            {projectName || <Skeleton className="h-5 w-32" />}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function NoSilosView({ companyId, projectId }: { companyId: string, projectId: string }) {
  const { isUserAdmin } = useSelectedWorkspace();
  return (
    <div className="text-center border-2 border-dashed border-muted rounded-lg p-12">
      <h2 className="text-xl font-semibold">No Silos Found</h2>
      <p className="text-muted-foreground mt-2 mb-4">
        Get started by adding your first silo to this project.
      </p>
      {isUserAdmin ? (
        <AddSiloDialog companyId={companyId} projectId={projectId}>
          <Button>Add Silo</Button>
        </AddSiloDialog>
      ) : (
        <p className="text-sm text-muted-foreground">
          You do not have permission to add silos.
        </p>
      )}
    </div>
  );
}

function SiloActions({ silo, companyId, projectId }: { silo: Silo; companyId: string; projectId: string; }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { selectedWorkspace } = useSelectedWorkspace();

    const handleDelete = async () => {
        if (!selectedWorkspace) return;
        const siloRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', silo.id);
        try {
            await deleteDoc(siloRef);
            toast({
                title: "Silo Deleted",
                description: `"${silo.name}" has been deleted.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Error Deleting Silo",
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
                    <EditSiloDialog silo={silo} companyId={companyId} projectId={projectId}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            Edit
                        </DropdownMenuItem>
                    </EditSiloDialog>
                    <DeleteDialog onConfirm={handleDelete} itemName={silo.name}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                            Delete
                        </DropdownMenuItem>
                    </DeleteDialog>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function SiloItem({ silo, companyId, projectId }: { silo: Silo, companyId: string, projectId: string }) {
  const { isUserAdmin, selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const tasksQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', silo.id, 'tasks');
  }, [firestore, selectedWorkspace, companyId, projectId, silo.id]);

  const { data: tasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);
  
  // Recalculate project progress when tasks change for *this specific silo*
  useEffect(() => {
    if (selectedWorkspace) {
        updateProjectProgress(firestore, selectedWorkspace.id, companyId, projectId);
    }
  }, [tasks, firestore, selectedWorkspace, companyId, projectId]); // This effect now correctly recalculates progress


  const completedTasks = tasks?.filter(t => t.completed).length || 0;
  const totalTasks = tasks?.length || 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isSiloComplete = progress === 100 && totalTasks > 0;

  return (
    <AccordionItem key={silo.id} value={silo.id} className="border-none">
      <Card className="relative">
          {isUserAdmin && <SiloActions silo={silo} companyId={companyId} projectId={projectId} />}
          <AccordionTrigger className={cn("p-4 text-lg font-medium hover:no-underline pr-12", { "text-muted-foreground line-through": isSiloComplete })}>
            <div className="flex-1 text-left flex items-center gap-2">
              {isSiloComplete && <CheckCircle2 className="text-green-500" />}
              <span>{silo.name}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className='px-4 pb-4 space-y-4'>
                <div className="space-y-2">
                   <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-muted-foreground">{completedTasks} of {totalTasks} tasks complete</span>
                      <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
                <div className="border rounded-md">
                    {tasksLoading && <div className="p-4 text-center text-sm">Loading tasks...</div>}
                    {tasks && tasks.length > 0 ? (
                      <div className="divide-y">
                        {tasks.map(task => (
                           <TaskItem key={task.id} task={task} path={`workspaces/${selectedWorkspace?.id}/companies/${companyId}/projects/${projectId}/silos/${silo.id}/tasks/${task.id}`} />
                        ))}
                      </div>
                    ) : (
                      !tasksLoading && <p className="p-4 text-center text-sm text-muted-foreground">No tasks in this silo yet.</p>
                    )}
                </div>
                 {isUserAdmin && <AddTaskDialog companyId={companyId} projectId={projectId} siloId={silo.id} />}
            </div>
          </AccordionContent>
      </Card>
    </AccordionItem>
  )
}

function SilosList({ companyId, projectId }: { companyId: string, projectId: string }) {
  const { isUserAdmin, selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const silosQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    const silosRef = collection(
      firestore,
      'workspaces',
      selectedWorkspace.id,
      'companies',
      companyId,
      'projects',
      projectId,
      'silos'
    );
    return query(silosRef, orderBy('order'));
  }, [firestore, selectedWorkspace, companyId, projectId]);

  const { data: silos, isLoading } = useCollection<Silo>(silosQuery);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!silos || silos.length === 0) {
    return <NoSilosView companyId={companyId} projectId={projectId} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-headline">Silos</h2>
        {isUserAdmin && <AddSiloDialog companyId={companyId} projectId={projectId} />}
      </div>
      <Accordion type="multiple" defaultValue={silos.map(s => s.id)} className="w-full space-y-4">
        {silos.map(silo => (
          <SiloItem key={silo.id} silo={silo} companyId={companyId} projectId={projectId} />
        ))}
      </Accordion>
    </div>
  );
}

function SalesProgress({ project, companyId }: { project: Project, companyId: string }) {
    const { isUserAdmin, selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    const salesTarget = project.monetaryValue || 0;
    const salesAchieved = project.totalSalesValue || 0;
    const salesProgress = salesTarget > 0 ? Math.round((salesAchieved / salesTarget) * 100) : 0;

    const salesQuery = useMemoFirebase(() => {
        if (!selectedWorkspace) return null;
        return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', project.id, 'sales');
    }, [firestore, selectedWorkspace, companyId, project.id]);

    const { data: sales, isLoading } = useCollection<Sale>(salesQuery);

    return (
      <Accordion type="single" collapsible defaultValue="sales-progress" className="w-full">
        <AccordionItem value="sales-progress" className="border-none">
          <Card>
              <AccordionTrigger className="p-4 text-lg font-medium hover:no-underline">
                  <div className="flex-1 text-left">
                    Sales Progress
                  </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-4 pt-0">
                    <CardDescription className="pb-4">
                        Track sales towards the project target of ZAR {salesTarget.toLocaleString()}.
                    </CardDescription>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-muted-foreground">
                                ZAR {salesAchieved.toLocaleString()} / ZAR {salesTarget.toLocaleString()}
                            </span>
                            <span className="font-medium">{salesProgress}%</span>
                        </div>
                        <Progress value={salesProgress} />
                    </div>
                    
                    <div className="border rounded-md">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead className="text-right">Amount (ZAR)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && <TableRow><TableCell colSpan={3} className="text-center">Loading sales...</TableCell></TableRow>}
                                {sales && sales.length > 0 ? (
                                    sales.map(sale => (
                                        <TableRow key={sale.id}>
                                            <TableCell>{format(new Date(sale.date), 'PPP')}</TableCell>
                                            <TableCell className="font-medium">{sale.source}</TableCell>
                                            <TableCell className="text-right">{sale.value.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    !isLoading && <TableRow><TableCell colSpan={3} className="text-center h-24">No sales logged yet.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {isUserAdmin && <AddSaleDialog project={project} companyId={companyId} />}
                </CardContent>
              </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    )
}

function ProjectProgress({ project }: { project: Project }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Overall Project Progress</CardTitle>
                <CardDescription>Combined progress from sales and task completion.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="space-y-2">
                   <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-muted-foreground">Total Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} />
                </div>
            </CardContent>
        </Card>
    );
}

export default function ProjectPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const projectId = params.projectId as string;
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const projectRef = useMemoFirebase(() => {
    if (!selectedWorkspace || !companyId || !projectId) return null;
    return doc(
      firestore,
      'workspaces',
      selectedWorkspace.id,
      'companies',
      companyId,
      'projects',
      projectId
    );
  }, [firestore, selectedWorkspace, companyId, projectId]);

  const { data: project, isLoading: isProjectLoading } = useDoc<Project>(projectRef);

  const companyRef = useMemoFirebase(() => {
    if (!selectedWorkspace || !companyId) return null;
    return doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId);
  }, [firestore, selectedWorkspace, companyId]);

  const { data: company, isLoading: isCompanyLoading } = useDoc<Company>(companyRef);

  const isLoading = isProjectLoading || isCompanyLoading;

  // Initial progress calculation on load
  useEffect(() => {
    if (selectedWorkspace && !isLoading && project) {
        updateProjectProgress(firestore, selectedWorkspace.id, companyId, projectId);
    }
  }, [firestore, selectedWorkspace, companyId, projectId, isLoading, project]);

  if (isLoading || !project || !company) {
    return (
      <div className="space-y-6">
        <ProjectBreadcrumb />
        <Skeleton className="h-10 w-1/2 mt-4" />
        <Skeleton className="h-5 w-3/4" />
        <div className="mt-8">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectBreadcrumb company={company} projectName={project.name} />
      <div className="mt-4">
        <h1 className="text-4xl font-headline font-bold">{project.name}</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Viewing project within the <span className="font-semibold text-foreground">{company.name}</span> company.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <ProjectProgress project={project} />
        {project.hasMonetaryValue && <SalesProgress project={project} companyId={companyId} />}
        <SilosList companyId={companyId} projectId={projectId} />
      </div>
    </div>
  );
}
