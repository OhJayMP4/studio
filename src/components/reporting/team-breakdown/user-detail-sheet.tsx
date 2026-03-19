'use client';

import React, { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { Task, UserProfile } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isPast, isToday, addDays, isWithinInterval, startOfDay, endOfDay, differenceInDays, startOfWeek, formatDistanceToNow } from 'date-fns';
import { UserActivityFeed } from './user-activity-feed';
import { ClipboardCheck, Clock, AlertCircle, CalendarRange, CheckCircle2, TrendingUp } from 'lucide-react';

interface UserDetailSheetProps {
  user: UserProfile;
  onClose: () => void;
  tasks: Task[];
}

/**
 * Safely converts a value to a Date object, handling Firestore Timestamps,
 * serialized callable function responses, strings, and direct Date objects.
 */
const safeToDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    
    // Handle serialized Timestamp from Cloud Functions (Callable)
    const seconds = val.seconds ?? val._seconds;
    if (seconds !== undefined) {
        return new Date(seconds * 1000);
    }
    
    // Handle strings (ISO format)
    if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    
    return null;
};

export function UserDetailSheet({ user, onClose, tasks }: UserDetailSheetProps) {
  const now = new Date();
  const next7Days = addDays(now, 7);
  const weekStart = startOfWeek(now);

  const stats = useMemo(() => {
    const active = tasks.filter(t => !t.completed);
    const overdue = active.filter(t => isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)));
    const upcoming = active.filter(t => isWithinInterval(new Date(t.dueDate), {
      start: startOfDay(now),
      end: endOfDay(next7Days)
    }));
    
    const finishedThisWeek = tasks.filter(t => {
        if (!t.completed || !t.completedAt) return false;
        const compDate = safeToDate(t.completedAt);
        return compDate && compDate >= weekStart;
    }).sort((a, b) => {
        const dateA = safeToDate(a.completedAt)?.getTime() || 0;
        const dateB = safeToDate(b.completedAt)?.getTime() || 0;
        return dateB - dateA;
    });

    return { active, overdue, upcoming, finishedThisWeek };
  }, [tasks, weekStart, next7Days, now]);

  if (!user) return null;

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[600px] w-full flex flex-col p-0 overflow-hidden">
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
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Active</p>
                <p className="text-2xl font-bold">{stats.active.length}</p>
              </div>
              <div className="bg-destructive/5 border border-destructive/10 p-4 rounded-xl text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-destructive mb-1">Overdue</p>
                <p className="text-2xl font-bold">{stats.overdue.length}</p>
              </div>
              <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-xl text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">This Week</p>
                <p className="text-2xl font-bold text-green-600">{stats.finishedThisWeek.length}</p>
              </div>
            </div>

            <Tabs defaultValue="tasks" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="tasks" className="gap-2">
                        <ClipboardCheck className="h-4 w-4" /> Workload
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="gap-2">
                        <Clock className="h-4 w-4" /> Activity
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="space-y-8">
                    <div className="space-y-6">
                        {stats.overdue.length > 0 && (
                            <div className="space-y-3">
                            <p className="text-xs font-bold text-destructive flex items-center gap-1.5 uppercase tracking-wider">
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

                        <div className="space-y-3">
                            <p className="text-xs font-bold text-green-600 flex items-center gap-1.5 uppercase tracking-wider">
                                <TrendingUp className="h-3.5 w-3.5" /> Finished This Week
                            </p>
                            {stats.finishedThisWeek.length > 0 ? (
                                <div className="space-y-2">
                                    {stats.finishedThisWeek.map(task => {
                                        const compDate = safeToDate(task.completedAt);
                                        return (
                                            <div key={task.id} className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-2 truncate pr-4">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                                    <span className="font-medium truncate line-through opacity-70">{task.title}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-green-600 whitespace-nowrap">
                                                    {compDate ? formatDistanceToNow(compDate, { addSuffix: true }) : 'Completed'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic pl-5">No tasks completed yet this week.</p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs font-bold text-blue-500 flex items-center gap-1.5 uppercase tracking-wider">
                                <CalendarRange className="h-3.5 w-3.5" /> Upcoming Queue
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
                            <p className="text-xs text-muted-foreground italic pl-5">No upcoming tasks due in the next 7 days.</p>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="activity">
                    <UserActivityFeed userId={user.uid} />
                </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
