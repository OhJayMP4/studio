'use client';

import React from 'react';
import { DayPicker, DayProps } from 'react-day-picker';
import { isSameDay, isToday } from 'date-fns';
import { UserTask } from '@/lib/types';
import { TaskCalendarItem } from './task-calendar-item';
import { cn } from '@/lib/utils';

interface TaskCalendarProps {
  tasks: UserTask[];
}

const MAX_TASKS_PER_DAY = 4;

function CustomDay(
  props: DayProps & {
    tasksForDay: UserTask[];
  }
) {
  const { tasksForDay, date } = props;

  const sortedTasks = tasksForDay.sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });

  const visibleTasks = sortedTasks.slice(0, MAX_TASKS_PER_DAY);
  const hiddenCount = sortedTasks.length - visibleTasks.length;

  return (
    <div className="h-28 w-full p-1 relative flex flex-col group">
      <span className={cn(
        "text-[10px] font-medium w-6 h-6 flex items-center justify-center rounded-full ml-auto mb-1",
        isToday(date) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
      )}>
        {date.getDate()}
      </span>

      <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
        {visibleTasks.map((task) => (
          <TaskCalendarItem key={task.id} task={task} />
        ))}

        {hiddenCount > 0 && (
          <div className="text-[9px] text-muted-foreground font-semibold px-1.5 mt-0.5">
            + {hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskCalendar({ tasks }: TaskCalendarProps) {
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <DayPicker
        mode="single"
        className="w-full p-0"
        classNames={{
          months: 'flex flex-col w-full',
          month: 'space-y-4 w-full',
          caption: 'flex justify-center py-4 relative items-center border-b bg-muted/30',
          caption_label: 'text-sm font-bold uppercase tracking-widest',
          nav: 'space-x-1 flex items-center',
          nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity',
          nav_button_previous: 'absolute left-4',
          nav_button_next: 'absolute right-4',
          table: 'w-full border-collapse',
          head_row: 'flex w-full bg-muted/10',
          head_cell: 'text-muted-foreground w-full font-bold text-[10px] uppercase py-3 text-center border-b',
          row: 'flex w-full border-b last:border-0',
          cell: 'h-28 text-center text-sm p-0 relative w-full border-r last:border-r-0',
        }}
        components={{
          Day: (props: DayProps) => {
            const tasksForDay = tasks.filter((task) =>
              isSameDay(new Date(task.dueDate), props.date)
            );
            return <CustomDay {...props} tasksForDay={tasksForDay} />;
          },
        }}
      />
    </div>
  );
}
