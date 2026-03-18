
'use client';

import React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, CheckCircle2, MessageSquare, Trash2, Bell, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSelectedWorkspace } from '@/app/(main)/layout';

const getIcon = (type: Notification['type']) => {
  switch (type) {
    case 'task_assigned': return <UserPlus className="h-3 w-3 text-blue-500" />;
    case 'task_completed': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case 'comment_added': return <MessageSquare className="h-3 w-3 text-amber-500" />;
    case 'task_deleted': return <Trash2 className="h-3 w-3 text-destructive" />;
    default: return <Bell className="h-3 w-3 text-muted-foreground" />;
  }
}

const getFeedText = (n: Notification) => {
  switch (n.type) {
    case 'task_assigned':
      return `Was assigned ${n.target.name}`;
    case 'task_completed':
      return `Completed task: ${n.target.name}`;
    case 'comment_added':
      return `Commented on ${n.target.name}`;
    case 'task_deleted':
      return `Deleted task: ${n.target.name}`;
    default:
      return n.target.name || 'Performed an action';
  }
}

export function UserActivityFeed({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const { selectedWorkspace } = useSelectedWorkspace();

  const activityQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    // Query for activities where this user is the actor OR the assignee
    return query(
      collection(firestore, `notifications/${selectedWorkspace.id}/activities`),
      where('isRelevantTo', 'array-contains', userId),
      orderBy('timestamp', 'desc'),
      limit(15)
    );
  }, [firestore, selectedWorkspace, userId]);

  const { data: activities, isLoading } = useCollection<Notification>(activityQuery);

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}</div>;

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 bg-muted/10 rounded-xl border border-dashed">
        <Sparkles className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 group">
          <div className="mt-1 bg-background border rounded-full p-1.5 shadow-sm">
            {getIcon(activity.type)}
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-xs leading-relaxed">
              <span className="font-bold">{activity.actorUid === userId ? 'User' : activity.actorName}</span>
              {' '}{getFeedText(activity)}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">
              {activity.timestamp ? formatDistanceToNow(new Date(activity.timestamp.seconds * 1000), { addSuffix: true }) : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
