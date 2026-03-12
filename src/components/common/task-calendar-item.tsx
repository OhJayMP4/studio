
'use client';

import React from 'react';
import { UserTask } from '@/lib/types';
import { cn } from '@/lib/utils';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TaskDetailsDialog } from './task-details-dialog';

interface TaskCalendarItemProps {
  task: UserTask;
}

const priorityStyles = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

export function TaskCalendarItem({ task }: TaskCalendarItemProps) {
  // Map UserTask back to a format TaskDetailsDialog expects (it needs the path)
  const originalTaskPath = `workspaces/${task.workspaceId}/companies/${task.companyId}/projects/${task.projectId}/silos/${task.siloId}/tasks/${task.originalTaskId}`;
  
  // Create a Task object from UserTask for the dialog
  const taskForDialog = {
    id: task.originalTaskId,
    title: task.title,
    description: task.description,
    completed: task.completed,
    dueDate: task.dueDate,
    priority: task.priority,
    assigneeId: task.assigneeId,
    projectId: task.projectId,
    workspaceId: task.workspaceId,
    createdBy: task.createdBy || '',
    createdAt: task.createdAt || null,
  };

  const MAX_LEN = 20;
  const previewTitle = task.title.length > MAX_LEN ? task.title.slice(0, MAX_LEN) + '...' : task.title;

  return (
    <TaskDetailsDialog task={taskForDialog as any} path={originalTaskPath}>
      <div
        className={cn(
          "flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-accent cursor-pointer text-[10px] w-full overflow-hidden transition-colors",
          task.completed && "opacity-50"
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', priorityStyles[task.priority])} />
            </TooltipTrigger>
            <TooltipContent>
              <p className="capitalize">Priority: {task.priority}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <span className={cn("truncate flex-1 text-left", task.completed && "line-through")}>
          {previewTitle}
        </span>
      </div>
    </TaskDetailsDialog>
  );
}
