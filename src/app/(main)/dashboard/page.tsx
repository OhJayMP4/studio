'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { Company, Project, Task } from "@/lib/types";
import ProjectStatusChart from "@/components/reporting/project-status-chart";
import TaskPriorityChart from "@/components/reporting/task-priority-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertCircle, ArrowRight, Zap, ArrowLeft, Building, Folder, CheckCircle2 } from "lucide-react";
import { format, isPast, isToday, addDays, isBefore } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DashboardDetailView = 'main' | 'active-projects' | 'completed-projects' | 'total-tasks' | 'overdue-tasks';

// Extended types to include names for display in lists
type ProjectWithContext = Project & { companyName: string };
type TaskWithContext = Task & { companyName: string; projectName: string };

function TaskListRow({ task }: { task: TaskWithContext }) {
  const dueDate = new Date(task.dueDate);
  const overdue = !task.completed && isPast(dueDate) && !isToday(dueDate);
  const isQuickTask = task.projectId === 'general-tasks';
  const projectName = isQuickTask ? 'Quick Tasks' : task.projectName;
  
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
          <span className="text-[10px] text-muted-foreground truncate opacity-70">
            • {task.companyName} / {projectName}
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

function DetailHeader({ title, onBack }: { title: string, onBack: () => void }) {
    return (
        <div className="flex items-center gap-4 mb-6">
            <Button variant="outline" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-headline font-bold">{title}</h2>
        </div>
    );
}

function DashboardView() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const [projects, setProjects] = useState<ProjectWithContext[]>([]);
  const [tasks, setTasks] = useState<TaskWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailView, setDetailView] = useState<DashboardDetailView>('main');

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
        
        let allProjects: ProjectWithContext[] = [];
        let allTasks: TaskWithContext[] = [];

        for (const companyDoc of companiesSnapshot.docs) {
          const companyData = companyDoc.data() as Company;
          const companyName = companyData.name;
          
          const projectsRef = collection(companyDoc.ref, 'projects');
          const projectsSnapshot = await getDocs(projectsRef);
          
          for (const projectDoc of projectsSnapshot.docs) {
            const projectDataRaw = projectDoc.data();
            const isQuickTaskProject = projectDoc.id === 'general-tasks';
            const projectName = isQuickTaskProject ? 'Quick Tasks' : projectDataRaw.name;
            
            const projectData = { id: projectDoc.id, ...projectDataRaw, companyName, name: projectName } as ProjectWithContext;
            if (projectData.status === 'archived') continue;
            
            allProjects.push(projectData);
            
            const projectSilosRef = collection(projectDoc.ref, 'silos');
            const silosSnapshot = await getDocs(projectSilosRef);

            for (const siloDoc of silosSnapshot.docs) {
              const siloTasksRef = collection(siloDoc.ref, 'tasks');
              const tasksSnapshot = await getDocs(siloTasksRef);
              tasksSnapshot.forEach(taskDoc => {
                allTasks.push({ 
                    id: taskDoc.id, 
                    ...taskDoc.data(), 
                    companyName, 
                    projectName: projectName 
                } as TaskWithContext);
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
    // Exclude the internal 'general-tasks' project from project lists/counts
    const activeProjectsList = projects.filter(p => p.id !== 'general-tasks' && (p.status === 'active' || !p.status));
    const completedProjectsList = projects.filter(p => p.id !== 'general-tasks' && (p.status === 'completed' || p.progress === 100));
    
    const overdueTasksList = tasks.filter(t => !t.completed && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)));
    
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

    const quickTasksList = tasks
      .filter(t => !t.completed && t.projectId === 'general-tasks')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    return { 
        activeProjects: activeProjectsList,
        completedProjects: completedProjectsList, 
        overdueTasks: overdueTasksList, 
        highPriorityUpcoming, 
        quickTasksList
    };
  }, [projects, tasks]);

  if (detailView === 'active-projects') {
      return (
          <div className="space-y-6">
              <DetailHeader title="Active Projects" onBack={() => setDetailView('main')} />
              <Card>
                  <CardContent className="p-0">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Project</TableHead>
                                  <TableHead>Company</TableHead>
                                  <TableHead>Deadline</TableHead>
                                  <TableHead className="text-right">Progress</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {stats.activeProjects.map(p => (
                                  <TableRow key={p.id}>
                                      <TableCell className="font-medium">
                                          <Link href={`/company/${p.companyId}/project/${p.id}`} className="flex items-center gap-2 hover:underline">
                                              <Folder className="h-4 w-4 text-primary" />
                                              {p.name}
                                          </Link>
                                      </TableCell>
                                      <TableCell>
                                          <Link href={`/company/${p.companyId}`} className="text-muted-foreground hover:underline">
                                              {p.companyName}
                                          </Link>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                          {p.deadline ? format(new Date(p.deadline), 'MMM d, yyyy') : '-'}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums">
                                          {p.progress}%
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
          </div>
      );
  }

  if (detailView === 'completed-projects') {
    return (
        <div className="space-y-6">
            <DetailHeader title="Completed Projects" onBack={() => setDetailView('main')} />
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Project</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Completed Date</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.completedProjects.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">
                                        <Link href={`/company/${p.companyId}/project/${p.id}`} className="flex items-center gap-2 hover:underline">
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            {p.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/company/${p.companyId}`} className="text-muted-foreground hover:underline">
                                            {p.companyName}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {p.completedAt ? format(p.completedAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {p.hasMonetaryValue ? `R${p.monetaryValue?.toLocaleString()}` : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (detailView === 'total-tasks') {
    return (
        <div className="space-y-6">
            <DetailHeader title="Total Workspace Tasks" onBack={() => setDetailView('main')} />
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Company / Project</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead className="text-right">Priority</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(t => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {t.projectId === 'general-tasks' && <Zap className="h-3 w-3 text-primary fill-current" />}
                                            <span className={cn(t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={t.completed ? "secondary" : "outline"}>
                                            {t.completed ? "Completed" : "In Progress"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {t.companyName} <span className="mx-1">/</span> {t.projectName}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {format(new Date(t.dueDate), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={t.priority === 'high' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                                            {t.priority}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (detailView === 'overdue-tasks') {
    return (
        <div className="space-y-6">
            <DetailHeader title="Overdue Tasks" onBack={() => setDetailView('main')} />
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.overdueTasks.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium text-destructive">
                                        {t.title}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {t.companyName}
                                    </TableCell>
                                    <TableCell className="font-semibold text-destructive">
                                        {format(new Date(t.dueDate), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="destructive" className="uppercase text-[10px]">
                                            {t.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href="/my-tasks">Complete Task</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
         <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setDetailView('active-projects')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16"/> : <p className="text-3xl font-bold">{stats.activeProjects.length}</p>}
          </CardContent>
        </Card>
        <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setDetailView('completed-projects')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</CardTitle>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16"/> : <p className="text-3xl font-bold">{stats.completedProjects.length}</p>}
          </CardContent>
        </Card>
        <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setDetailView('total-tasks')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16"/> : <p className="text-3xl font-bold">{tasks.length}</p>}
          </CardContent>
        </Card>
        <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setDetailView('overdue-tasks')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive uppercase tracking-wider">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16"/> : <p className="text-3xl font-bold text-destructive">{stats.overdueTasks.length}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <AlertCircle className="h-5 w-5 fill-current" />
              <CardTitle>Urgent & High Priority</CardTitle>
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
            ) : stats.overdueTasks.length > 0 ? (
              <div className="flex flex-col">
                {stats.overdueTasks.slice(0, 5).map(task => (
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
            <CardDescription>One-off items from Quick Tasks project.</CardDescription>
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
