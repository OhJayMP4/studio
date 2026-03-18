
'use client';

import React, { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import type { Task, Notification } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { isPast, isToday, addDays, isWithinInterval, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { UserActivityFeed } from './user-activity-feed';
import { ClipboardCheck, Clock, AlertCircle, CalendarRange, Building } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserDetailSheetProps {
  userId: string;
  onClose: () => void;
  tasks: Task[];
}

export function UserDetailSheet({ userId, onClose, tasks }: UserDetailSheetProps) {
  const { selectedWorkspace } = useSelectedWorkspace();
  const user = selectedWorkspace?.users[userId];

  const now = new Date();
  const next7Days = addDays(now, 7);

  const stats = useMemo(() => {
    const active = tasks.filter(t => !t.completed);
    const overdue = active.filter(t => isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)));
    const upcoming = active.filter(t => isWithinInterval(new Date(t.dueDate), {
      start: startOfDay(now),
      end: endOfDay(next7Days)
    }));

    // Project/Company distribution
    const projectMap: Record<string, number> = {};
    tasks.forEach(t => {
      if (!t.completed) {
        projectMap[t.projectId] = (projectMap[t.projectId] || 0) + 1;
      }
    });

    return { active, overdue, upcoming, projectMap };
  }, [tasks]);

  if (!user) return null;

  return (
    <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col p-0 overflow-hidden">
        <SheetHeader className="p-6 pb-2 border-b bg-muted/10">
          <div className="flex items-center gap-4">
            <SheetTitle className="text-2xl font-headline font-bold">{user.name || user.email}</SheetTitle>
          </div>
          <SheetDescription className="pt-1">
            Detailed performance and workload breakdown.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-10 pb-20">
            {/* Workload Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Active</p>
                <p className="text-2xl font-bold">{stats.active.length}</p>
              </div>
              <div className="bg-destructive/5 border border-destructive/10 p-4 rounded-xl text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-destructive mb-1">Overdue</p>
                <p className="text-2xl font-bold">{stats.overdue.length}</p>
              </div>
              <div className="bg-muted p-4 rounded-xl text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">This Week</p>
                <p className="text-2xl font-bold">{stats.upcoming.length}</p>
              </div>
            </div>

            {/* Task Breakdown */}
            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" /> Task Breakdown
              </h3>

              {/* Overdue */}
              {stats.overdue.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Overdue Attention
                  </p>
                  <div className="space-y-2">
                    {stats.overdue.map(task => {
                      const days = differenceInDays(now, new Date(task.dueDate));
                      return (
                        <div key={task.id} className="p-3 bg-destructive/5 border border-destructive/10 rounded-lg flex justify-between items-center text-sm">
                          <span className="font-semibold truncate pr-4">{task.title}</span>
                          <span className="text-[10px] font-black text-destructive whitespace-nowrap bg-white px-2 py-0.5 rounded shadow-sm">
                            {days} DAYS LATE
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-blue-500 flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5" /> Upcoming (Next 7 Days)
                </p>
                {stats.upcoming.length > 0 ? (
                  <div className="space-y-2">
                    {stats.upcoming.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(task => (
                      <div key={task.id} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg flex justify-between items-center text-sm">
                        <span className="font-medium truncate pr-4">{task.title}</span>
                        <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">
                          {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-5">No upcoming tasks due this week.</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Activity Feed */}
            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Recent Activity
              </h3>
              <UserActivityFeed userId={userId} />
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
