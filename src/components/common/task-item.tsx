'use client';

import { useFirestore, useMemoFirebase } from "@/firebase";
import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Task, UserProfile } from "@/lib/types";
import { doc, updateDoc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Checkbox } from "../ui/checkbox";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Badge } from "../ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface TaskItemProps {
    task: Task;
    path: string; // full path to the task document
}

const priorityStyles = {
    low: 'bg-blue-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
}

export function TaskItem({ task, path }: TaskItemProps) {
    const firestore = useFirestore();

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

    return (
        <div className={cn("flex items-center justify-between p-3 rounded-md hover:bg-muted/50", {
            "opacity-60": task.completed,
        })}>
            <div className="flex items-center gap-4">
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
                 <Badge variant={task.completed ? "secondary" : "outline"} className="hidden sm:inline-flex">
                    Due: {format(new Date(task.dueDate), 'MMM d')}
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
            </div>
        </div>
    )
}
