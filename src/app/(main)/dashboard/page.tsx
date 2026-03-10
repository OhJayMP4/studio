'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { Project, Task } from "@/lib/types";
import ProjectStatusChart from "@/components/reporting/project-status-chart";
import TaskPriorityChart from "@/components/reporting/task-priority-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertCircle, ArrowRight, Zap } from "lucide-react";
import { format, isPast, isToday, addDays, isBefore } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function TaskListRow({ task }: { task: Task }) {
  const dueDate = new Date(task.dueDate);
  const overdue = !task.completed && isPast(dueDate) && !isToday(dueDate);
  const isQuickTask = task.projectId === 'general-tasks';
  
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
            <span className={cn("font-medium text-sm truncate", task.completed && "line-through text-muted-foreground")}>
            {task.title}
            </span>
            {isQuickTask && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Zap className="h-3 w-3 text-primary fill-current" />
                        </TooltipTrigger>
                        <TooltipContent>Quick Task</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0 uppercase">
            {task.priority}
          </Badge>
          <span className={cn("text-xs flex items-center gap-1", overdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
            <Calendar className="h-3 w-3" />
            {format(dueDate, 'MMM d')}
          </span>
        </div>
      </div>
      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
        <Link href="/my-tasks">
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

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
        const workspaceCompaniesRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
        const companiesSnapshot = await getDocs(workspaceCompaniesRef);
        
        let allProjects: Project[] = [];
        let allTasks: Task[] = [];

        for (const companyDoc of companiesSnapshot.docs) {
          const projectsRef = collection(companyDoc.ref, 'projects');
          const projectsSnapshot = await getDocs(projectsRef);
          
          for (const projectDoc of projectsSnapshot.docs) {
            const projectData = { id: projectDoc.id, ...projectDoc.data() } as Project;
            if (projectData.status === 'archived') continue;
            
            allProjects.push(projectData);
            
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
  
  const stats = useMemo(() => {
    const activeTasks = tasks.filter(t => !t.completed);
    const completedProjectsCount = projects.filter(p => p.status === 'completed' || p.progress === 100).length;
    const overdueTasksCount = tasks.filter(t => !t.completed && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))).length;
    
    const now = new Date();
    const urgentThreshold = addDays(now, 2);

    const highPriorityUpcoming = tasks
      .filter(t => {
          if (t.completed) return false;
          const dueDate = new Date(t.dueDate);
          return t.priority === 'high' || isBefore(dueDate, urgentThreshold);
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    const overdueList = tasks
      .filter(t => !t.completed && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    const quickTasksList = tasks
      .filter(t => !t.completed && t.projectId === 'general-tasks')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    return { 
        completedProjects: completedProjectsCount, 
        overdueTasks: overdueTasksCount, 
        highPriorityUpcoming, 
        overdueList,
        quickTasksList
    };
  }, [projects, tasks]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
         <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16"/> : <p className="text-3xl font-bold">{projects.filter(p => p.status === 'active' || !p.status).length}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</CardTitle>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16"/> : <p className="text-3xl font-bold">{stats.completedProjects}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16"/> : <p className="text-3xl font-bold">{tasks.length}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive uppercase tracking-wider">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16"/> : <p className="text-3xl font-bold text-destructive">{stats.overdueTasks}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <AlertCircle className="h-5 w-5 fill-current" />
              <CardTitle>Priority & Urgent</CardTitle>
            </div>
            <CardDescription>Top upcoming or high priority items.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : stats.highPriorityUpcoming.length > 0 ? (
              <div className="flex flex-col">
                {stats.highPriorityUpcoming.map(task => (
                  <TaskListRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No urgent tasks found.
              </div>
            )}
          </CardContent>
          <CardHeader className="pt-0">
            <Button variant="link" className="px-0 h-auto justify-start text-primary" asChild>
              <Link href="/my-tasks">Full task list <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
        </Card>

        <Card className="flex flex-col border-destructive/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Overdue Action</CardTitle>
            </div>
            <CardDescription>Tasks past their deadline.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : stats.overdueList.length > 0 ? (
              <div className="flex flex-col">
                {stats.overdueList.map(task => (
                  <TaskListRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Clean slate! No overdue tasks.
              </div>
            )}
          </CardContent>
          <CardHeader className="pt-0">
            <Button variant="link" className="px-0 h-auto justify-start text-destructive" asChild>
              <Link href="/my-tasks">View all <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
        </Card>

        <Card className="flex flex-col border-accent-foreground/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Zap className="h-5 w-5 fill-current" />
              <CardTitle>Quick Tasks</CardTitle>
            </div>
            <CardDescription>One-off items from General Tasks.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : stats.quickTasksList.length > 0 ? (
              <div className="flex flex-col">
                {stats.quickTasksList.map(task => (
                  <TaskListRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No active quick tasks.
              </div>
            )}
          </CardContent>
          <CardHeader className="pt-0">
            <Button variant="link" className="px-0 h-auto justify-start" asChild>
              <Link href="/my-tasks">Manage all tasks <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
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
