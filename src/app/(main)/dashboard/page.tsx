
'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, collectionGroup, Timestamp, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import type { Project, Task, Company } from "@/lib/types";
import ProjectStatusChart from "@/components/reporting/project-status-chart";
import TaskPriorityChart from "@/components/reporting/task-priority-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Archive } from "lucide-react";


function ReadyToArchive() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [archiveReadyProjects, setArchiveReadyProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedWorkspace?.id) {
      setIsLoading(false);
      return;
    }
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const thirtyDaysAgo = Timestamp.fromDate(subDays(new Date(), 30));
        const projectsRef = collectionGroup(firestore, 'projects');
        const q = query(
          projectsRef,
          where('workspaceId', '==', selectedWorkspace.id),
          where('status', '==', 'completed'),
          where('completedAt', '<=', thirtyDaysAgo)
        );
        const querySnapshot = await getDocs(q);
        const projects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setArchiveReadyProjects(projects);
      } catch (e) {
        console.error("Failed to fetch projects ready for archive:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, [selectedWorkspace, firestore]);

  const handleArchive = async (project: Project) => {
    const projectRef = doc(firestore, 'workspaces', project.workspaceId, 'companies', project.companyId, 'projects', project.id);
    try {
      await updateDoc(projectRef, {
        status: 'archived',
        archivedAt: serverTimestamp()
      });
      toast({ title: 'Project Archived', description: `"${project.name}" has been moved to the archive.` });
      setArchiveReadyProjects(prev => prev.filter(p => p.id !== project.id));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Archive Failed', description: e.message });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (archiveReadyProjects.length === 0) {
    return null; // Don't show the card if there's nothing to do
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects Ready to Archive</CardTitle>
        <CardDescription>These completed projects can be archived to clean up your workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {archiveReadyProjects.map(p => (
          <div key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
            <div>
              <Link href={`/company/${p.companyId}/project/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
              <p className="text-sm text-muted-foreground">
                Completed {p.completedAt ? formatDistanceToNow((p.completedAt as Timestamp).toDate(), { addSuffix: true }) : ''}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleArchive(p)}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


function DashboardView() {
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
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
          const projectsRef = collection(companyDoc.ref, 'projects');
          const projectsSnapshot = await getDocs(query(projectsRef, where('status', '!=', 'archived')));
          
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
  
  const completedProjects = projects?.filter(p => p.progress === 100).length || 0;
  const overdueTasks = tasks?.filter(t => !t.completed && new Date(t.dueDate) < new Date()).length || 0;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
         <h1 className="text-3xl font-headline">Dashboard for {selectedWorkspace?.name}</h1>
      </div>
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Active Projects</CardTitle>
            <CardDescription>All non-archived projects in the workspace.</CardDescription>
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
            <CardDescription>All tasks across all active projects.</CardDescription>
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

      <ReadyToArchive />

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
