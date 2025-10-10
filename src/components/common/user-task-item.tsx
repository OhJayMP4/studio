
'use client';

import { useFirestore } from "@/firebase";
import { Task, UserProfile, UserTask } from "@/lib/types";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Checkbox } from "../ui/checkbox";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Badge } from "../ui/badge";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { updateTaskCompletion } from "@/lib/tasks";
import Link from "next/link";

interface UserTaskItemProps {
    userTask: UserTask;
}

export function UserTaskItem({ userTask }: UserTaskItemProps) {
    const firestore = useFirestore();
    const { task, project, companyId, workspaceId, siloId } = userTask;

    const assigneeRef = useMemoFirebase(() => {
        return task.assigneeId ? doc(firestore, 'users', task.assigneeId) : null;
    }, [firestore, task.assigneeId]);

    const { data: assignee } = useDoc<UserProfile>(assigneeRef);

    const handleCheckChanged = async (checked: boolean) => {
        const originalTaskPath = `workspaces/${workspaceId}/companies/${companyId}/projects/${task.projectId}/silos/${siloId}/tasks/${userTask.originalTaskId}`;
        try {
            await updateTaskCompletion(firestore, originalTaskPath, task.assigneeId, userTask.originalTaskId, checked);
        } catch (error) {
            console.error("Failed to update task:", error);
        }
    }

    const name = assignee?.name || 'N/A';
    const avatarUrl = assignee?.avatarUrl || '';
    const fallback = name.charAt(0).toUpperCase();

    const dueDate = new Date(task.dueDate);
    const isOverdue = !task.completed && isPast(dueDate) && !isToday(dueDate);

    const linkHref = `/company/${companyId}/project/${task.projectId}`;

    return (
        <div className={cn("flex items-center justify-between p-3 group", { "opacity-60": task.completed })}>
            <div className="flex items-center gap-4">
                <Checkbox
                    id={`task-${userTask.id}`}
                    checked={task.completed}
                    onCheckedChange={handleCheckChanged}
                    aria-label={`Mark task "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
                />
                <div className="flex flex-col">
                     <Link href={linkHref} className="hover:underline">
                        <span className={cn("text-sm font-medium leading-none", { "line-through text-muted-foreground": task.completed })}>
                            {task.title}
                        </span>
                    </Link>
                    <span className="text-xs text-muted-foreground">{project.name}</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                 <Badge variant={isOverdue ? "destructive" : (task.completed ? "secondary" : "outline")} className="hidden sm:inline-flex">
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
        </div>
    )
}

// Minimal useMemoFirebase to satisfy the linter until it's globally available
// In a real scenario, this would be in a shared utility file.
const useMemoFirebase = <T>(factory: () => T, deps: React.DependencyList): T => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return React.useMemo(factory, deps);
};
