'use client';

import React, { useState } from "react";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { UserProfile, UserTask } from "@/lib/types";
import { doc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Checkbox } from "../ui/checkbox";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Badge } from "../ui/badge";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { updateTaskCompletion, updateTaskStatus } from "@/lib/tasks";
import type { TaskStatus } from "@/lib/types";
import Link from "next/link";
import { PlayCircle, Clock, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { TaskCompletionDialog } from "./task-completion-dialog";
import { useSelectedWorkspace } from "@/app/(main)/layout";
import { TaskDetailsDialog } from "./task-details-dialog";

interface TaskGridItemProps {
    userTask: UserTask;
}

const priorityStyles = {
    low: 'bg-blue-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
}

export function TaskGridItem({ userTask }: TaskGridItemProps) {
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);
    const { selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    const { originalTaskId, workspaceId, companyId, projectId, siloId } = userTask;

    const assigneeRef = useMemoFirebase(() => {
        return userTask.assigneeId ? doc(firestore, 'users', userTask.assigneeId) : null;
    }, [firestore, userTask.assigneeId]);

    const { data: assignee } = useDoc<UserProfile>(assigneeRef);

    const handleCheckChanged = async (checked: boolean) => {
        if (checked) {
            if (selectedWorkspace?.isTimeTrackingEnabled) {
                setShowCompletionDialog(true);
            } else {
                const originalTaskPath = `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${originalTaskId}`;
                try {
                    await updateTaskCompletion(firestore, originalTaskPath, userTask.assigneeId, originalTaskId, true, 0);
                } catch (error) {
                    console.error("Failed to update task:", error);
                }
            }
        } else {
            const originalTaskPath = `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${originalTaskId}`;
            try {
                await updateTaskCompletion(firestore, originalTaskPath, userTask.assigneeId, originalTaskId, false, 0);
            } catch (error) {
                console.error("Failed to update task:", error);
            }
        }
    }

    const onConfirmCompletion = async (minutes: number) => {
        const originalTaskPath = `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${originalTaskId}`;
        await updateTaskCompletion(firestore, originalTaskPath, userTask.assigneeId, originalTaskId, true, minutes);
    }

    // Resolve Name prioritizing Profile Name -> Profile Email -> Stale Workspace Name
    const name = assignee?.name || assignee?.email || selectedWorkspace?.users?.[userTask.assigneeId]?.name || 'N/A';
    const avatarUrl = assignee?.avatarUrl || '';
    const fallback = name.charAt(0).toUpperCase();

    const handleStatusChange = async (status: TaskStatus) => {
        const originalTaskPath = `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${originalTaskId}`;
        try {
            await updateTaskStatus(firestore, originalTaskPath, userTask.assigneeId, originalTaskId, status);
        } catch (error) {
            console.error("Failed to update task status:", error);
        }
    };

    const dueDate = new Date(userTask.dueDate);
    const effectiveStatus = userTask.status || (userTask.completed ? 'completed' : 'todo');
    const isOverdue = effectiveStatus !== 'awaiting_approval' && !userTask.completed && isPast(dueDate) && !isToday(dueDate);

    const originalTaskPath = `workspaces/${userTask.workspaceId}/companies/${userTask.companyId}/projects/${userTask.projectId}/silos/${userTask.siloId}/tasks/${userTask.originalTaskId}`;
    
    const taskForDialog = {
        id: userTask.originalTaskId,
        title: userTask.title,
        description: userTask.description,
        completed: userTask.completed,
        dueDate: userTask.dueDate,
        priority: userTask.priority,
        assigneeId: userTask.assigneeId,
        projectId: userTask.projectId,
        workspaceId: userTask.workspaceId,
        createdBy: userTask.createdBy || '',
        createdAt: userTask.createdAt || null,
    };

    return (
       <Card className={cn("flex flex-col", { "opacity-60": userTask.completed })}>
           <CardHeader>
               <div className="flex justify-between items-start">
                   <div className="flex items-center gap-3">
                        <Checkbox
                            id={`task-${userTask.id}`}
                            checked={userTask.completed}
                            onCheckedChange={handleCheckChanged}
                            aria-label={`Mark task "${userTask.title}" as ${userTask.completed ? 'incomplete' : 'complete'}`}
                        />
                        <TaskDetailsDialog task={taskForDialog as any} path={originalTaskPath}>
                            <button className="hover:underline text-left">
                                <CardTitle className={cn({ "line-through text-muted-foreground": userTask.completed })}>
                                    {userTask.title}
                                </CardTitle>
                            </button>
                        </TaskDetailsDialog>
                   </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className={`w-3 h-3 rounded-full ${priorityStyles[userTask.priority]}`} />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Priority: {userTask.priority.charAt(0).toUpperCase() + userTask.priority.slice(1)}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
               </div>
           </CardHeader>
           <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{userTask.description}</p>
           </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                 <Breadcrumb className="text-xs text-muted-foreground">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbPage>{userTask.companyName}</BreadcrumbPage>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                             <BreadcrumbPage>{userTask.projectName}</BreadcrumbPage>
                        </BreadcrumbItem>
                         <BreadcrumbSeparator />
                        <BreadcrumbItem>
                           <BreadcrumbPage>{userTask.siloName}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                {!userTask.completed && (
                    <div className="flex gap-1.5 w-full">
                        <button
                            onClick={() => handleStatusChange(effectiveStatus === 'in_progress' ? 'todo' : 'in_progress')}
                            className={cn(
                                "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors flex-1 justify-center",
                                effectiveStatus === 'in_progress'
                                    ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-700"
                                    : "text-muted-foreground border-muted-foreground/30 hover:border-blue-400 hover:text-blue-600"
                            )}
                        >
                            <PlayCircle className="h-3 w-3" />
                            {effectiveStatus === 'in_progress' ? 'In Progress' : 'In Progress'}
                        </button>
                        <button
                            onClick={() => handleStatusChange(effectiveStatus === 'awaiting_approval' ? 'todo' : 'awaiting_approval')}
                            className={cn(
                                "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors flex-1 justify-center",
                                effectiveStatus === 'awaiting_approval'
                                    ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-700"
                                    : "text-muted-foreground border-muted-foreground/30 hover:border-amber-400 hover:text-amber-600"
                            )}
                        >
                            <Clock className="h-3 w-3" />
                            Awaiting
                        </button>
                    </div>
                )}
                <div className="flex justify-between items-center w-full">
                    <Badge variant={isOverdue ? "destructive" : (userTask.completed ? "secondary" : "outline")}>
                        {format(dueDate, 'MMM d')}
                    </Badge>
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={avatarUrl} alt={name} />
                                    <AvatarFallback>{fallback}</AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Assigned to {name}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardFooter>

            <TaskCompletionDialog 
                open={showCompletionDialog}
                onOpenChange={setShowCompletionDialog}
                onConfirm={onConfirmCompletion}
                taskTitle={userTask.title}
            />
       </Card>
    )
}
