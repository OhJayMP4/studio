'use client';

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import type { Project, Task, UserTask } from "@/lib/types";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";

function useUserTasks(userId?: string) {
    const firestore = useFirestore();
    
    const tasksQuery = useMemoFirebase(() => {
        if (!userId) return null;
        return query(
            collection(firestore, `user-tasks/${userId}/tasks`)
        );
    }, [firestore, userId]);

    const { data, isLoading, error } = useCollection<UserTask>(tasksQuery);
    
    return { data, isLoading, error };
}


function TaskListItem({ userTask }: { userTask: UserTask }) {
    const { task, project, companyId } = userTask;
    const dueDate = new Date(task.dueDate);
    const isOverdue = !task.completed && isPast(dueDate) && !isToday(dueDate);

    if (!project) {
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
                    <p className="text-xs text-muted-foreground">{project.name}</p>
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
    const [view, setView] = useState<'active' | 'completed'>('active');
    const { data: userTasks, isLoading } = useUserTasks(user?.uid);
    
    const filteredAndSortedTasks = useMemo(() => {
        if (!userTasks) return [];
        
        const filtered = userTasks.filter(userTask => {
            return view === 'active' ? !userTask.task.completed : userTask.task.completed;
        });

        // Sort the filtered tasks
        return filtered.sort((a, b) => {
            const dateA = new Date(a.task.dueDate).getTime();
            const dateB = new Date(b.task.dueDate).getTime();
            return view === 'active' ? dateA - dateB : dateB - dateA; // Asc for active, Desc for completed
        });
    }, [userTasks, view]);


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
                            filteredAndSortedTasks.map(userTask => (
                                <TaskListItem key={userTask.id} userTask={userTask} />
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

    