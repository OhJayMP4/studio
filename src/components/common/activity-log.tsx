'use client';

import React, { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '../ui/button';
import {
  Activity, MessageSquare, UserPlus, CheckCircle2, Trash2,
  Folder, Box, Building2, FileText, ArrowRight,
} from 'lucide-react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '../ui/scroll-area';

// ─── icon map ─────────────────────────────────────────────────────────────────

function getTypeIcon(type: Notification['type']) {
  switch (type) {
    case 'comment_added':   return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
    case 'task_assigned':   return <UserPlus      className="h-3.5 w-3.5 text-violet-500" />;
    case 'task_completed':  return <CheckCircle2  className="h-3.5 w-3.5 text-emerald-500" />;
    case 'task_deleted':
    case 'project_deleted':
    case 'company_deleted':
    case 'silo_deleted':    return <Trash2        className="h-3.5 w-3.5 text-red-500" />;
    case 'project_added':   return <Folder        className="h-3.5 w-3.5 text-amber-500" />;
    case 'silo_added':      return <Box           className="h-3.5 w-3.5 text-amber-500" />;
    case 'company_added':   return <Building2     className="h-3.5 w-3.5 text-amber-500" />;
    case 'sale_added':      return <FileText      className="h-3.5 w-3.5 text-teal-500" />;
    default:                return <Activity      className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getActivityText(n: Notification): React.ReactNode {
  const bold = (s?: string) => <span className="font-semibold">{s}</span>;
  switch (n.type) {
    case 'comment_added':   return <>{bold(n.actorName)} commented on {bold(n.target.name)}</>;
    case 'task_assigned':   return <>{bold(n.actorName)} assigned {bold(n.target.name)} to {bold(n.assignee?.name)}</>;
    case 'task_completed':  return <>{bold(n.actorName)} completed {bold(n.target.name)}</>;
    case 'task_deleted':    return <>{bold(n.actorName)} deleted task {bold(n.target.name)}</>;
    case 'project_added':   return <>{bold(n.actorName)} created project {bold(n.target.name)}</>;
    case 'project_deleted': return <>{bold(n.actorName)} deleted project {bold(n.target.name)}</>;
    case 'company_added':   return <>{bold(n.actorName)} added company {bold(n.target.name)}</>;
    case 'company_deleted': return <>{bold(n.actorName)} deleted company {bold(n.target.name)}</>;
    case 'silo_added':      return <>{bold(n.actorName)} added silo {bold(n.target.name)}</>;
    case 'silo_deleted':    return <>{bold(n.actorName)} deleted silo {bold(n.target.name)}</>;
    case 'sale_added':      return <>{bold(n.actorName)} logged a sale: {bold(n.target.name)}</>;
    default:                return <>{bold(n.actorName)} made a change</>;
  }
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-px p-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 rounded-lg p-3 animate-pulse">
          <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted/50 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ActivityLog() {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedWorkspace } = useSelectedWorkspace();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const q = useMemoFirebase(() => {
    if (!selectedWorkspace || !user) return null;
    return query(
      collection(firestore, `notifications/${selectedWorkspace.id}/activities`),
      orderBy('timestamp', 'desc'),
      limit(40),
    );
  }, [firestore, selectedWorkspace, user]);

  const { data: events, isLoading } = useCollection<Notification>(q);

  // group by day
  const grouped = useMemo(() => {
    if (!events) return [];
    const groups: Array<{ label: string; items: Notification[] }> = [];
    const todayItems: Notification[] = [];
    const yesterdayItems: Notification[] = [];
    const earlier: Map<string, Notification[]> = new Map();

    events.forEach(e => {
      if (!e.timestamp) { earlier.set('Older', [...(earlier.get('Older') ?? []), e]); return; }
      const d = new Date(e.timestamp.seconds * 1000);
      if (isToday(d)) todayItems.push(e);
      else if (isYesterday(d)) yesterdayItems.push(e);
      else {
        const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        earlier.set(label, [...(earlier.get(label) ?? []), e]);
      }
    });

    if (todayItems.length)     groups.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems });
    earlier.forEach((items, label) => groups.push({ label, items }));

    return groups;
  }, [events]);

  const hasAny = (events?.length ?? 0) > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'relative flex items-center justify-center w-9 h-9 rounded-lg',
            'transition-colors duration-150',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'text-muted-foreground hover:text-foreground',
            isOpen && 'bg-accent text-foreground',
          )}
          aria-label="Toggle activity log"
        >
          <Activity className="h-5 w-5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[400px] p-0 rounded-xl shadow-2xl border-border/80 overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20 shrink-0">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Activity Log</h3>
          <span className="text-[11px] text-muted-foreground ml-1">— everything that happened</span>
        </div>

        {/* body */}
        <ScrollArea className="max-h-[480px]">
          {isLoading ? (
            <Skeleton />
          ) : !hasAny ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 gap-2">
              <Activity className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
            </div>
          ) : (
            <div className="pb-1">
              {grouped.map(group => (
                <div key={group.label}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {group.label}
                  </p>
                  {group.items.map(event => (
                    <button
                      key={event.id}
                      onClick={() => {
                        if (event.target.path) router.push(event.target.path);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
                    >
                      <span className="mt-0.5 shrink-0">{getTypeIcon(event.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-snug text-foreground truncate">
                          {getActivityText(event)}
                        </p>
                        {event.type === 'comment_added' && event.context?.commentText && (
                          <p className="text-[12px] text-muted-foreground italic truncate">
                            "{event.context.commentText}"
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {event.timestamp
                            ? formatDistanceToNow(new Date(event.timestamp.seconds * 1000), { addSuffix: true })
                            : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* footer */}
        <div className="border-t bg-muted/10 px-2 py-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-7"
            onClick={() => { router.push('/notifications'); setIsOpen(false); }}
          >
            View full activity log
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
