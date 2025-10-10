'use client';

import { useSelectedWorkspace } from '@/app/(main)/layout';
import { AddSiloDialog } from '@/components/common/add-silo-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { Company, Project, Sale, Silo, Task } from '@/lib/types';
import { collection, doc, query, orderBy, getDocs, runTransaction, deleteDoc, writeBatch, addDoc } from 'firebase/firestore';
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
import { CheckCircle2, GripVertical, MoreVertical } from 'lucide-react';
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
import { useEffect, useMemo, useState } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EditSiloDialog } from '@/components/common/edit-silo-dialog';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


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
            // Also delete all tasks within the silo
            const tasksCollection = collection(siloRef, 'tasks');
            const tasksSnapshot = await getDocs(tasksCollection);
            const batch = writeBatch(firestore);
            tasksSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            batch.delete(siloRef);
            await batch.commit();

            toast({
                title: "Silo Deleted",
                description: `"${silo.name}" and all its tasks have been deleted.`,
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
        <div className="absolute top-2 right-2 z-10">
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

const priorityOrder = { high: 3, medium: 2, low: 1 };

function SortableSiloItem({ silo, companyId, projectId }: { silo: Silo; companyId: string; projectId: string }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: silo.id, data: { type: 'Silo' } });
    const { isUserAdmin, selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    
    const tasksQuery = useMemoFirebase(() => {
        if (!selectedWorkspace) return null;
        return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', silo.id, 'tasks');
    }, [firestore, selectedWorkspace, companyId, projectId, silo.id]);

    const { data: rawTasks, isLoading: rawTasksLoading } = useCollection<Task>(tasksQuery);

    const sortedTasks = useMemo(() => {
        if (!rawTasks) return [];
        return [...rawTasks].sort((a, b) => {
            if (a.completed && !b.completed) return 1;
            if (!a.completed && b.completed) return -1;
            const dateA = new Date(a.dueDate).getTime();
            const dateB = new Date(b.dueDate).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }, [rawTasks]);

    useEffect(() => {
        if (selectedWorkspace && !rawTasksLoading) {
            updateProjectProgress(firestore, selectedWorkspace.id, companyId, projectId);
        }
    }, [rawTasks, rawTasksLoading, firestore, selectedWorkspace, companyId, projectId]);

    const completedTasks = rawTasks?.filter(t => t.completed).length || 0;
    const totalTasks = rawTasks?.length || 0;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const isSiloComplete = progress === 100 && totalTasks > 0;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    return (
       <AccordionItem value={silo.id} ref={setNodeRef} style={style} className='border-none'>
          <Card className="overflow-hidden">
                <AccordionTrigger className="p-4 flex flex-row items-center justify-between hover:no-underline relative border-b data-[state=open]:border-b-0">
                    <div {...listeners} {...attributes} className="absolute top-0 left-0 h-full w-8 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center">
                       <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <CardTitle className={cn("flex-1 text-left flex items-center gap-2 text-lg pl-6", { "text-muted-foreground line-through": isSiloComplete })}>
                        {isSiloComplete && <CheckCircle2 className="text-green-500" />}
                        <span>{silo.name}</span>
                    </CardTitle>
                    {isUserAdmin && <SiloActions silo={silo} companyId={companyId} projectId={projectId} />}
                </AccordionTrigger>
                <AccordionContent>
                    <CardContent className='pt-0 space-y-4'>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-muted-foreground">{completedTasks} of {totalTasks} tasks complete</span>
                                <span className="font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} />
                        </div>
                        <div className="border rounded-md">
                            {rawTasksLoading && <div className="p-4 text-center text-sm">Loading tasks...</div>}
                             <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                {sortedTasks && sortedTasks.length > 0 ? (
                                    <div className="divide-y">
                                    {sortedTasks.map(task => (
                                        <TaskItem key={task.id} task={task} siloId={silo.id} path={`workspaces/${selectedWorkspace?.id}/companies/${companyId}/projects/${projectId}/silos/${silo.id}/tasks/${task.id}`} />
                                    ))}
                                    </div>
                                ) : (
                                    !rawTasksLoading && <p className="p-4 text-center text-sm text-muted-foreground">No tasks in this silo yet.</p>
                                )}
                            </SortableContext>
                        </div>
                        {isUserAdmin && <AddTaskDialog companyId={companyId} projectId={projectId} siloId={silo.id} />}
                    </CardContent>
                </AccordionContent>
            </Card>
       </AccordionItem>
    );
}


function SilosList({ companyId, projectId }: { companyId: string, projectId: string }) {
  const { isUserAdmin, selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const { toast } = useToast();

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
  const [activeItem, setActiveItem] = useState<{id: string; type: 'Silo' | 'Task'; data: any} | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type;
    if (type === 'Silo') {
        setActiveItem({ id: active.id as string, type: 'Silo', data: silos?.find(s => s.id === active.id) });
    }
    if (type === 'Task') {
        setActiveItem({ id: active.id as string, type: 'Task', data: active.data.current?.task });
    }
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;

    // Handle Silo reordering
    if (active.data.current?.type === 'Silo' && over && active.id !== over.id && silos) {
      const oldIndex = silos.findIndex(s => s.id === active.id);
      const newIndex = silos.findIndex(s => s.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newOrderSilos = Array.from(silos);
      const [movedItem] = newOrderSilos.splice(oldIndex, 1);
      newOrderSilos.splice(newIndex, 0, movedItem);

      if (!selectedWorkspace) return;

      const batch = writeBatch(firestore);
      newOrderSilos.forEach((silo, index) => {
        const siloRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', silo.id);
        batch.update(siloRef, { order: index });
      });

      try {
        await batch.commit();
        toast({ title: 'Silos reordered successfully.' });
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error reordering silos', description: e.message });
      }
    }
  };

  const handleDragOver = async (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !selectedWorkspace) return;

    const activeIsTask = active.data.current?.type === 'Task';
    // over can be a silo (AccordionItem) or the content area inside it
    const overIsSilo = over.data.current?.type === 'Silo' || over.data.current?.siloId;
    const targetSiloId = over.data.current?.type === 'Silo' ? over.id : over.data.current?.siloId;

    if (activeIsTask && overIsSilo) {
        const task = active.data.current.task as Task;
        const sourceSiloId = active.data.current.siloId as string;

        if (sourceSiloId === targetSiloId) return;

        // Optimistically update UI - This is complex, so we will rely on Firestore's real-time updates for now
        // For a smoother UX, you would move the item in the local state here.

        const sourceTaskRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', sourceSiloId, 'tasks', task.id);
        const targetTasksColRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', targetSiloId, 'tasks');

        try {
            await runTransaction(firestore, async (transaction) => {
                const taskDoc = await transaction.get(sourceTaskRef);
                if (!taskDoc.exists()) return;
                const taskData = taskDoc.data();
                transaction.delete(sourceTaskRef);
                transaction.set(doc(targetTasksColRef, task.id), taskData);
            });
            toast({ title: "Task moved", description: `Task "${task.title}" moved to new silo.` });
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Error moving task', description: e.message });
        }
    }
  };

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-headline">Silos</h2>
        {isUserAdmin && <AddSiloDialog companyId={companyId} projectId={projectId} />}
      </div>
      <div className="w-full space-y-4">
           <Accordion type="multiple" className="space-y-4">
                <SortableContext items={silos.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {silos.map(silo => (
                      <SortableSiloItem key={silo.id} silo={silo} companyId={companyId} projectId={projectId} />
                    ))}
                </SortableContext>
           </Accordion>
        </div>
      <DragOverlay>
        {activeItem?.type === 'Silo' && activeItem.data ? (
             <Card className="shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex-1 text-left flex items-center gap-2 text-lg">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                      <span>{activeItem.data.name}</span>
                  </CardTitle>
                </CardHeader>
            </Card>
        ) : null}
         {activeItem?.type === 'Task' && activeItem.data ? (
            <TaskItem task={activeItem.data} siloId={''} path={''} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
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
      <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
        <AccordionItem value="item-1" className="border-none">
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
