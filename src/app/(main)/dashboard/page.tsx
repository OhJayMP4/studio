'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore } from "@/firebase";
import { collectionGroup, query, where, getDocs } from "firebase/firestore";
import type { Project, Task } from "@/lib/types";
import ProjectStatusChart from "@/components/reporting/project-status-chart";
import TaskPriorityChart from "@/components/reporting/task-priority-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";


function DashboardView() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedWorkspace?.id || !firestore) {
      setIsLoading(false);
      return;
    }

    const fetchWorkspaceData = async () => {
      setIsLoading(true);
      try {
        const workspaceDocPath = `workspaces/${selectedWorkspace.id}`;
        
        // Correctly query the 'projects' collection group
        const projectsQuery = query(
          collectionGroup(firestore, 'projects'),
          where('__name__', '>=', `${workspaceDocPath}/companies/`),
          where('__name__', '<', `${workspaceDocPath}/companies0`)
        );
        const projectsSnap = await getDocs(projectsQuery);
        const allProjects = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(allProjects);

        // Correctly query the 'tasks' collection group
        const tasksQuery = query(
          collectionGroup(firestore, 'tasks'),
          where('__name__', '>=', `${workspaceDocPath}/companies/`),
          where('__name__', '<', `${workspaceDocPath}/companies0`)
        );
        const tasksSnap = await getDocs(tasksQuery);
        const allTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(allTasks);

      } catch (error) {
        console.error("Error fetching dashboard data: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWorkspaceData();
}, [selectedWorkspace, firestore]);

  
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
        <ProjectStatusChart projects={projects} isLoading={isLoading} />
        <TaskPriorityChart tasks={tasks} isLoading={isLoading} />
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
