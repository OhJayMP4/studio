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
import { updateTaskCompletion } from "@/lib/tasks";
import Link from "next/link";
import { TableCell, TableRow } from "../ui/table";
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

interface TaskListItemProps {
    userTask: UserTask;
}

export function TaskListItem({ userTask }: TaskListItemProps) {
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

    const dueDate = new Date(userTask.dueDate);
    const isOverdue = !userTask.completed && isPast(dueDate) && !isToday(dueDate);

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
       <TableRow className={cn({ "opacity-60": userTask.completed })}>
            <TableCell>
                 <Checkbox
                    id={`task-list-${userTask.id}`}
                    checked={userTask.completed}
                    onCheckedChange={handleCheckChanged}
                    aria-label={`Mark task "${userTask.title}" as ${userTask.completed ? 'incomplete' : 'complete'}`}
                />
            </TableCell>
            <TableCell>
                 <div className="flex flex-col">
                    <TaskDetailsDialog task={taskForDialog as any} path={originalTaskPath}>
                        <button className="hover:underline text-left font-medium">
                            <span className={cn("text-sm font-medium leading-none", { "line-through text-muted-foreground": userTask.completed })}>
                                {userTask.title}
                            </span>
                        </button>
                    </TaskDetailsDialog>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{userTask.description}</p>
                </div>
            </TableCell>
            <TableCell>
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
            </TableCell>
             <TableCell>
                 <Badge variant={isOverdue ? "destructive" : (userTask.completed ? "secondary" : "outline")}>
                    {format(dueDate, 'MMM d')}
                </Badge>
            </TableCell>
            <TableCell>
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
            </TableCell>
            
            <TaskCompletionDialog 
                open={showCompletionDialog}
                onOpenChange={setShowCompletionDialog}
                onConfirm={onConfirmCompletion}
                taskTitle={userTask.title}
            />
       </TableRow>
    )
}
