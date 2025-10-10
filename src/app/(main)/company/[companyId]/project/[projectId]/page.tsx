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
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { Company, Project, Silo, Task } from '@/lib/types';
import { collection, doc, query, orderBy } from 'firebase/firestore';
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
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function SiloItem({ silo, companyId, projectId }: { silo: Silo, companyId: string, projectId: string }) {
  const { isUserAdmin, selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const tasksQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', silo.id, 'tasks');
  }, [firestore, selectedWorkspace, companyId, projectId, silo.id]);

  const { data: tasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);

  const completedTasks = tasks?.filter(t => t.completed).length || 0;
  const totalTasks = tasks?.length || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const isSiloComplete = progress === 100 && totalTasks > 0;

  return (
    <AccordionItem key={silo.id} value={silo.id} className="border-none">
      <Card>
          <AccordionTrigger className={cn("p-4 text-lg font-medium hover:no-underline", { "text-muted-foreground line-through": isSiloComplete })}>
            <div className="flex-1 text-left flex items-center gap-2">
              {isSiloComplete && <CheckCircle2 className="text-green-500" />}
              <span>{silo.name}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className='px-4 pb-4 space-y-4'>
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-right">{completedTasks} of {totalTasks} tasks complete</p>
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
      <div className="mt-8">
        <SilosList companyId={companyId} projectId={projectId} />
      </div>
    </div>
  );
}
