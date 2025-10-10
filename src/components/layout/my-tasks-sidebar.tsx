'use client';

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collectionGroup, query, where } from "firebase/firestore";
import type { Project, Task } from "@/lib/types";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { useDocs } from "@/firebase/firestore/use-docs";

function TaskListItem({ task }: { task: Task & { project: Project | undefined, path: string } }) {
    const dueDate = new Date(task.dueDate);
    const isOverdue = !task.completed && isPast(dueDate) && !isToday(dueDate);

    // Extracting workspace/company/project IDs from the task path
    // Path format: workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}/tasks/{taskId}
    const pathSegments = task.path.split('/');
    const companyId = pathSegments[3];
    
    if (!task.project) {
        return (
            <div className="flex items-center justify-between p-2 rounded-md">
                <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
            </div>
        )
    }
    
    const linkHref = `/company/${companyId}/project/${task.projectId}`;

    return (
        <Link href={linkHref} className="block w-full text-left p-2 rounded-md hover:bg-sidebar-accent transition-colors">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <p className={cn("text-sm font-medium", { "line-through text-muted-foreground": task.completed })}>{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.project.name}</p>
                </div>
                <span className={cn("text-xs", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                    {format(dueDate, 'MMM d')}
                </span>
            </div>
        </Link>
    )
}

export function MyTasks() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [view, setView] = useState<'active' | 'completed'>('active');

    const tasksQuery = useMemoFirebase(() => {
        if (!user?.uid) return null;
        return query(
            collectionGroup(firestore, 'tasks'),
            where('assigneeId', '==', user.uid)
        );
    }, [firestore, user]);

    const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);
    
    // Create a list of unique project IDs from the fetched tasks
    const projectPaths = useMemo(() => {
        if (!tasks) return [];
        const paths = tasks.map(task => {
            const parts = task.path.split('/');
            // workspaces/{wsId}/companies/{cId}/projects/{pId}/...
            return parts.slice(0, 6).join('/');
        });
        return [...new Set(paths)];
    }, [tasks]);

    // Fetch all unique project documents
    const { data: projects, isLoading: isLoadingProjects } = useDocs<Project>(projectPaths);

    // Create a map for quick project lookup
    const projectsById = useMemo(() => {
        if (!projects) return new Map<string, Project>();
        return new Map(projects.map(p => [p.id, p]));
    }, [projects]);


    const filteredAndSortedTasks = useMemo(() => {
        if (!tasks) return [];
        
        const tasksWithProjectData = tasks.map(task => ({
            ...task,
            project: projectsById.get(task.projectId)
        }));

        const filtered = tasksWithProjectData.filter(task => {
            return view === 'active' ? !task.completed : task.completed;
        });

        return filtered.sort((a, b) => {
            const dateA = new Date(a.dueDate).getTime();
            const dateB = new Date(b.dueDate).getTime();
            return view === 'active' ? dateA - dateB : dateB - dateA;
        });
    }, [tasks, view, projectsById]);

    const isLoading = isLoadingTasks || isLoadingProjects;

    return (
        <AccordionItem value="my-tasks" className="border-none">
            <AccordionTrigger className="px-4 py-2 text-sm font-medium hover:no-underline hover:bg-sidebar-accent rounded-md">
                My Tasks
            </AccordionTrigger>
            <AccordionContent>
                <div className="px-2 space-y-2">
                    <div className="flex gap-1 bg-muted p-1 rounded-md">
                        <Button
                            size="sm"
                            variant={view === 'active' ? 'secondary' : 'ghost'}
                            onClick={() => setView('active')}
                            className="flex-1 h-7"
                        >
                            Active
                        </Button>
                        <Button
                            size="sm"
                            variant={view === 'completed' ? 'secondary' : 'ghost'}
                            onClick={() => setView('completed')}
                            className="flex-1 h-7"
                        >
                            Completed
                        </Button>
                    </div>

                    <div className="space-y-1 max-h-60 overflow-y-auto">
                        {isLoading && (
                            <div className="space-y-2 p-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        )}
                        {!isLoading && filteredAndSortedTasks.length > 0 && (
                            filteredAndSortedTasks.map(task => (
                                <TaskListItem key={task.id} task={task} />
                            ))
                        )}
                        {!isLoading && filteredAndSortedTasks.length === 0 && (
                            <div className="text-center p-4">
                                <p className="text-sm text-muted-foreground">
                                    {view === 'active' ? "No active tasks. Great job!" : "No completed tasks yet."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    )
}
