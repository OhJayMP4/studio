'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, collectionGroup } from "firebase/firestore";
import type { Project, Task, Company } from "@/lib/types";
import ProjectStatusChart from "@/components/reporting/project-status-chart";
import TaskPriorityChart from "@/components/reporting/task-priority-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";

function DashboardView() {
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
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
        const workspaceCompaniesRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
        const companiesSnapshot = await getDocs(workspaceCompaniesRef);
        
        let allProjects: Project[] = [];
        let allTasks: Task[] = [];

        for (const companyDoc of companiesSnapshot.docs) {
          const companyProjectsRef = collection(companyDoc.ref, 'projects');
          const projectsSnapshot = await getDocs(companyProjectsRef);
          
          for (const projectDoc of projectsSnapshot.docs) {
            allProjects.push({ id: projectDoc.id, ...projectDoc.data() } as Project);
            
            const projectSilosRef = collection(projectDoc.ref, 'silos');
            const silosSnapshot = await getDocs(projectSilosRef);

            for (const siloDoc of silosSnapshot.docs) {
              const siloTasksRef = collection(siloDoc.ref, 'tasks');
              const tasksSnapshot = await getDocs(siloTasksRef);
              tasksSnapshot.forEach(taskDoc => {
                allTasks.push({ id: taskDoc.id, ...taskDoc.data() } as Task);
              });
            }
          }
        }

        setProjects(allProjects);
        setTasks(allTasks);

      } catch (error) {
        console.error("Error fetching dashboard data: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWorkspaceData();
  }, [selectedWorkspace, firestore]);

  const handleCopyInviteLink = () => {
    if (!selectedWorkspace || !user) return;
    const inviteLink = `${window.location.origin}/invite?ws=${selectedWorkspace.id}&owner=${user.uid}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
        toast({
            title: "Invite Link Copied",
            description: "The invite link has been copied to your clipboard.",
        });
    });
  };
  
  const completedProjects = projects?.filter(p => p.progress === 100).length || 0;
  const overdueTasks = tasks?.filter(t => !t.completed && new Date(t.dueDate) < new Date()).length || 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-3xl font-headline">Dashboard for {selectedWorkspace?.name}</h1>
         {isUserAdmin && <Button size="sm" onClick={handleCopyInviteLink}>Invite Member</Button>}
      </div>
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Total Projects</CardTitle>
            <CardDescription>All projects in the workspace.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-end">
            {isLoading ? <Skeleton className="h-8 w-1/4"/> : <p className="text-4xl font-bold">{projects?.length || 0}</p>}
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Completed Projects</CardTitle>
            <CardDescription>Projects marked as 100% complete.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-end">
             {isLoading ? <Skeleton className="h-8 w-1/4"/> : <p className="text-4xl font-bold">{completedProjects}</p>}
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Total Tasks</CardTitle>
            <CardDescription>All tasks across all projects.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-end">
             {isLoading ? <Skeleton className="h-8 w-1/4"/> : <p className="text-4xl font-bold">{tasks?.length || 0}</p>}
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-destructive">Overdue Tasks</CardTitle>
            <CardDescription>Tasks past their due date.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-end">
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
             <AddWorkspaceDialog open={false} onOpenChange={() => {}} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DashboardView />;
}
