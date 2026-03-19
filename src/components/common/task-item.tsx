'use client';

import { useFirestore, useMemoFirebase } from "@/firebase";
import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Task, UserProfile, Comment } from "@/lib/types";
import { doc, collection, query } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Checkbox } from "../ui/checkbox";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useCollection } from "@/firebase/firestore/use-collection";
import { Badge } from "../ui/badge";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { EditTaskDialog } from "./edit-task-dialog";
import { DeleteDialog } from "./delete-dialog";
import { useToast } from "@/hooks/use-toast";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updateTaskCompletion, deleteTask } from "@/lib/tasks";
import { TaskDetailsDialog } from "./task-details-dialog";
import { TaskCompletionDialog } from "./task-completion-dialog";
import { useState } from "react";

interface TaskItemProps {
    task: Task;
    siloId: string;
    path: string; // full path to the task document
    isOverlay?: boolean;
}

const priorityStyles = {
    low: 'bg-blue-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
}

function TaskActions({ task, path }: { task: Task, path: string }) {
    const { toast } = useToast();
    const firestore = useFirestore();

    const handleDelete = async () => {
        try {
            await deleteTask(firestore, path, task.id, task.assigneeId);
            toast({
                title: "Task Deleted",
                description: `"${task.title}" has been deleted.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Error Deleting Task",
                description: error.message,
            });
        }
    };
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <EditTaskDialog task={task} path={path}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </EditTaskDialog>
                <DeleteDialog onConfirm={handleDelete} itemName={task.title}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        Delete
                    </DropdownMenuItem>
                </DeleteDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function TaskItem({ task, siloId, path, isOverlay }: TaskItemProps) {
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);
    const { selectedWorkspace } = useSelectedWorkspace();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
        id: task.id,
        data: {
            type: 'Task',
            task: task,
            siloId: siloId
        }
    });

    const firestore = useFirestore();

    const assigneeRef = useMemoFirebase(() => {
        return task.assigneeId ? doc(firestore, 'users', task.assigneeId) : null;
    }, [firestore, task.assigneeId]);
    
    const commentsQuery = useMemoFirebase(() => {
        return query(collection(firestore, `${path}/comments`));
    }, [firestore, path]);
    
    const { data: comments } = useCollection<Comment>(commentsQuery);
    const hasComments = comments && comments.length > 0;

    const { data: assignee } = useDoc<UserProfile>(assigneeRef);

    const handleCheckChanged = async (checked: boolean) => {
        if (checked) {
            if (selectedWorkspace?.isTimeTrackingEnabled) {
                setShowCompletionDialog(true);
            } else {
                try {
                    await updateTaskCompletion(firestore, path, task.assigneeId, task.id, true, 0);
                } catch (error) {
                    console.error("Failed to update task:", error);
                }
            }
        } else {
            try {
                await updateTaskCompletion(firestore, path, task.assigneeId, task.id, false, 0);
            } catch (error) {
                console.error("Failed to update task:", error);
            }
        }
    }

    const onConfirmCompletion = async (minutes: number) => {
        await updateTaskCompletion(firestore, path, task.assigneeId, task.id, true, minutes);
    }

    // Resolve Name prioritizing Profile Name -> Profile Email -> Stale Workspace Name
    const name = assignee?.name || assignee?.email || selectedWorkspace?.users?.[task.assigneeId]?.name || 'Unassigned';
    const avatarUrl = assignee?.avatarUrl || '';
    const fallback = name.charAt(0).toUpperCase();

    const dueDate = new Date(task.dueDate);
    const isOverdue = !task.completed && isPast(dueDate) && !isToday(dueDate);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={cn("flex items-center justify-between p-3 rounded-md hover:bg-muted/50 group bg-card", {
            "opacity-60": task.completed,
            "shadow-lg": isOverlay
        })}>
            <div className="flex items-center gap-4">
                <div {...listeners} {...attributes} className="cursor-grab touch-none">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
                <Checkbox
                    id={`task-${task.id}`}
                    checked={task.completed}
                    onCheckedChange={handleCheckChanged}
                />
                <TaskDetailsDialog task={task} path={path}>
                    <button
                        className={cn("text-sm font-medium leading-none text-left flex items-center gap-2", {
                            "line-through text-muted-foreground": task.completed
                        })}
                    >
                        <span>{task.title}</span>
                         {hasComments && <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
                    </button>
                </TaskDetailsDialog>
            </div>
            <div className="flex items-center gap-3">
                 <Badge variant={isOverdue ? "destructive" : (task.completed ? "secondary" : "outline")} className="hidden sm:inline-flex">
                    Due: {format(dueDate, 'MMM d')}
                </Badge>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                             <div className={`w-3 h-3 rounded-full ${priorityStyles[task.priority]}`} />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Priority: {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
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
                <div className="opacity-0 group-hover:opacity-100 transition-opacity"><TaskActions task={task} path={path} /></div>
            </div>

            <TaskCompletionDialog 
                open={showCompletionDialog}
                onOpenChange={setShowCompletionDialog}
                onConfirm={onConfirmCompletion}
                taskTitle={task.title}
            />
        </div>
    )
}
