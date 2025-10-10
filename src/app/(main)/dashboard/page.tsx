'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup, query, where, documentId } from "firebase/firestore";
import type { Company, Project, Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import ProjectStatusChart from "@/components/reporting/project-status-chart";
import TaskPriorityChart from "@/components/reporting/task-priority-chart";
import { Skeleton } from "@/components/ui/skeleton";


function DashboardView() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const projectsQuery = useMemoFirebase(() => {
    if (!selectedWorkspace?.id) return null;
    return query(
      collectionGroup(firestore, 'projects'),
      where(documentId(), '>=', `workspaces/${selectedWorkspace.id}/companies/`),
      where(documentId(), '<', `workspaces/${selectedWorkspace.id}/companies0`)
    );
  }, [firestore, selectedWorkspace]);

  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const tasksQuery = useMemoFirebase(() => {
      if (!selectedWorkspace?.id) return null;
      return query(
        collectionGroup(firestore, 'tasks'),
        where(documentId(), '>=', `workspaces/${selectedWorkspace.id}/companies/`),
        where(documentId(), '<', `workspaces/${selectedWorkspace.id}/companies0`)
      );
  }, [firestore, selectedWorkspace]);
  
  const { data: tasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);
  
  const isLoading = projectsLoading || tasksLoading;

  const completedProjects = projects?.filter(p => p.progress === 100).length || 0;
  const overdueTasks = tasks?.filter(t => !t.completed && new Date(t.dueDate) < new Date()).length || 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-3xl font-headline">Dashboard for {selectedWorkspace?.name}</h1>
      </div>
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Total Projects</CardTitle>
            <CardDescription>All projects in the workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/4"/> : <p className="text-4xl font-bold">{projects?.length || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed Projects</CardTitle>
            <CardDescription>Projects marked as 100% complete.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/4"/> : <p className="text-4xl font-bold">{completedProjects}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Tasks</CardTitle>
            <CardDescription>All tasks across all projects.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/4"/> : <p className="text-4xl font-bold">{tasks?.length || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Overdue Tasks</CardTitle>
            <CardDescription>Tasks past their due date.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/4"/> : <p className="text-4xl font-bold text-destructive">{overdueTasks}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <ProjectStatusChart workspaceId={selectedWorkspace!.id} />
        <TaskPriorityChart workspaceId={selectedWorkspace!.id} />
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const { selectedWorkspace } = useSelectedWorkspace();

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Welcome to SaturnSync</CardTitle>
            <CardDescription>Select a workspace from the sidebar to get started, or create a new one.</CardDescription>
          </CardHeader>
          <CardContent>
             <AddWorkspaceDialog />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DashboardView />;
}
