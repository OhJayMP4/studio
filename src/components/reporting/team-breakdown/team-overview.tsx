'use client';

import React, { useMemo, useState } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import type { Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isPast, isToday, addDays, isWithinInterval, startOfDay, endOfDay, startOfWeek } from 'date-fns';
import { UserDetailSheet } from './user-detail-sheet';
import { Calendar, ClipboardCheck, TrendingUp } from 'lucide-react';

interface UserSummary {
  uid: string;
  name: string;
  avatarUrl: string | null;
  activeCount: number;
  overdueCount: number;
  upcomingCount: number;
  completedThisWeek: number;
  nextDueTask: Task | null;
  tasks: Task[];
}

/**
 * Safely converts a value to a Date object.
 * Handles Firestore Timestamps, serialized timestamp objects {seconds, nanoseconds}, and strings.
 */
const safeToDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds !== undefined) return new Date(val.seconds * 1000);
    return new Date(val);
};

export function TeamOverview({ tasks }: { tasks: Task[] }) {
  const { selectedWorkspace } = useSelectedWorkspace();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const teamSummaries = useMemo(() => {
    if (!selectedWorkspace?.users) return [];

    const now = new Date();
    const next7Days = addDays(now, 7);
    const weekStart = startOfWeek(now);

    return Object.entries(selectedWorkspace.users).map(([uid, userData]) => {
      const userTasks = tasks.filter(t => t.assigneeId === uid);
      const activeTasks = userTasks.filter(t => !t.completed);
      
      const overdueTasks = activeTasks.filter(t => {
        const dueDate = new Date(t.dueDate);
        return isPast(dueDate) && !isToday(dueDate);
      });

      const upcomingTasks = activeTasks.filter(t => {
        const dueDate = new Date(t.dueDate);
        return isWithinInterval(dueDate, {
          start: startOfDay(now),
          end: endOfDay(next7Days)
        });
      });

      const completedThisWeek = userTasks.filter(t => {
        if (!t.completed || !t.completedAt) return false;
        const compDate = safeToDate(t.completedAt);
        return compDate && compDate >= weekStart;
      });

      const sortedActive = [...activeTasks].sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      return {
        uid,
        name: userData.name || userData.email || 'Unnamed User',
        avatarUrl: userData.avatarUrl || null,
        activeCount: activeTasks.length,
        overdueCount: overdueTasks.length,
        upcomingCount: upcomingTasks.length,
        completedThisWeek: completedThisWeek.length,
        nextDueTask: sortedActive[0] || null,
        tasks: userTasks,
      } as UserSummary;
    })
    .filter(u => u.activeCount > 0 || u.tasks.length > 0 || u.completedThisWeek > 0)
    .sort((a, b) => b.overdueCount - a.overdueCount || b.activeCount - a.activeCount);
  }, [tasks, selectedWorkspace]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teamSummaries.map((summary) => (
          <Card 
            key={summary.uid}
            className="group hover:border-primary/50 transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden"
            onClick={() => setSelectedUserId(summary.uid)}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar className="h-12 w-12 border-2 group-hover:border-primary transition-colors">
                <AvatarImage src={summary.avatarUrl ?? undefined} className="object-cover" />
                <AvatarFallback className="font-bold">{summary.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="truncate text-lg">{summary.name}</CardTitle>
                <div className="flex gap-2 mt-1">
                  {summary.overdueCount > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px] uppercase font-black">
                      {summary.overdueCount} Overdue
                    </Badge>
                  )}
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] uppercase font-bold">
                    {summary.activeCount} Active
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/30 p-2 rounded-md">
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-[9px] mb-1">Due This Week</p>
                  <p className="text-lg font-bold">{summary.upcomingCount}</p>
                </div>
                <div className="bg-primary/5 border border-primary/10 p-2 rounded-md">
                  <p className="text-primary font-bold uppercase tracking-widest text-[9px] mb-1 flex items-center gap-1">
                    <TrendingUp className="h-2 w-2" /> Finished This Week
                  </p>
                  <p className="text-lg font-bold text-primary">{summary.completedThisWeek}</p>
                </div>
              </div>

              {summary.nextDueTask ? (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-[9px] mb-1.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Next Priority
                  </p>
                  <p className="text-sm font-semibold truncate">{summary.nextDueTask.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Due: {new Date(summary.nextDueTask.dueDate).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div className="border-t pt-3 flex items-center justify-center gap-2 py-2">
                    <ClipboardCheck className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium text-muted-foreground">Queue is clear!</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedUserId && (
        <UserDetailSheet 
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          tasks={tasks.filter(t => t.assigneeId === selectedUserId)}
        />
      )}
    </>
  );
}