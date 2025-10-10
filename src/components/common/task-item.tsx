'use client';

import { useFirestore, useMemoFirebase } from "@/firebase";
import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Task, UserProfile } from "@/lib/types";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Checkbox } from "../ui/checkbox";
import { useDoc } from "@/firebase/firestore/use-doc";
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

interface TaskItemProps {
    task: Task;
    siloId: string;
    path: string; // full path to the task document
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
        const taskRef = doc(firestore, path);
        try {
            await deleteDoc(taskRef);
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

export function TaskItem({ task, siloId, path }: TaskItemProps) {
    const firestore = useFirestore();
    const { isUserAdmin } = useSelectedWorkspace();

    const assigneeRef = useMemoFirebase(() => {
        return task.assigneeId ? doc(firestore, 'users', task.assigneeId) : null;
    }, [firestore, task.assigneeId]);

    const { data: assignee } = useDoc<UserProfile>(assigneeRef);

    const handleCheckChanged = async (checked: boolean) => {
        const taskRef = doc(firestore, path);
        try {
            await updateDoc(taskRef, { completed: checked });
        } catch (error) {
            console.error("Failed to update task:", error);
        }
    }

    const name = assignee?.name || 'N/A';
    const avatarUrl = assignee?.avatarUrl || '';
    const fallback = name.charAt(0).toUpperCase();

    const dueDate = new Date(task.dueDate);
    const isOverdue = !task.completed && isPast(dueDate) && !isToday(dueDate);

    return (
        <div className={cn("flex items-center justify-between p-3 rounded-md hover:bg-muted/50 group", {
            "opacity-60": task.completed,
        })}>
            <div className="flex items-center gap-4">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                <Checkbox
                    id={`task-${task.id}`}
                    checked={task.completed}
                    onCheckedChange={handleCheckChanged}
                />
                <label
                    htmlFor={`task-${task.id}`}
                    className={cn("text-sm font-medium leading-none", {
                        "line-through text-muted-foreground": task.completed
                    })}
                >
                    {task.title}
                </label>
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
                {isUserAdmin && <div className="opacity-0 group-hover:opacity-100 transition-opacity"><TaskActions task={task} path={path} /></div>}
            </div>
        </div>
    )
}
