'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Notification } from '@/lib/types';
import { format } from 'date-fns';
import { UserPlus, CheckCircle2, MessageSquare, Trash2, Bell, Sparkles } from 'lucide-react';
import { useSelectedWorkspace } from '@/app/(main)/layout';

// Helper function to convert Firestore Timestamp to JavaScript Date
const convertFirestoreTimestampToDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  // If it's already a Date object (e.g., from a previous conversion or direct Date storage)
  if (timestamp instanceof Date) {
    return timestamp;
  }
  // If it's a Firestore Timestamp object (has toDate method)
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  // If it's a serialized object with _seconds and _nanoseconds (common when passed via callable functions)
  if (timestamp._seconds !== undefined && timestamp._nanoseconds !== undefined) {
    return new Date(timestamp._seconds * 1000 + Math.round(timestamp._nanoseconds / 1000000));
  }
  // If it's a number (milliseconds since epoch)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  // If it's a string (e.g., ISO format from backend)
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) { // Check if the parsed date is valid
      return date;
    }
  }
  // Fallback for any other unexpected format
  console.warn('Unexpected timestamp format:', timestamp);
  return null;
};

const getIcon = (type: Notification['type']) => {
  switch (type) {
    case 'task_assigned': return <UserPlus className="h-3 w-3 text-blue-500" />;
    case 'task_completed': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case 'comment_added': return <MessageSquare className="h-3 w-3 text-amber-500" />;
    case 'task_deleted': return <Trash2 className="h-3 w-3 text-destructive" />;
    default: return <Bell className="h-3 w-3 text-muted-foreground" />;
  }
}

const getSimplifiedActionText = (n: Notification, currentUserId: string) => {
  switch (n.type) {
    case 'task_assigned':
      if (n.actorUid === currentUserId) {
        // Current user assigned the task to someone else
        return `assigned task: ${n.target.name} to ${n.assignee?.name || 'an unknown user'}`;
      } else if (n.assignee?.uid === currentUserId) {
        // Current user was assigned the task by someone else
        return `was assigned task: ${n.target.name} by ${n.actorName}`;
      } else {
        // Fallback, though ideally one of the above would match
        return `assigned task: ${n.target.name}`;
      }
    case 'task_completed':
      return `completed task: ${n.target.name}`;
    case 'comment_added':
      return `commented on task: ${n.target.name}`;
    case 'task_deleted':
      return `deleted task: ${n.target.name}`;
    case 'company_added':
      return `created company: ${n.target.name}`;
    case 'project_added':
      return `created project: ${n.target.name}`;
    case 'silo_added':
      return `created silo: ${n.target.name}`;
    case 'sale_added':
      return `added a sale: ${n.target.name}`;
    case 'company_deleted':
      return `deleted company: ${n.target.name}`;
    case 'project_deleted':
      return `deleted project: ${n.target.name}`;
    default:
      return `performed an action on ${n.target.name || 'an item'}`;
  }
};

export function UserActivityFeed({ userId }: { userId: string }) {
  const { firebaseApp } = useFirebase();
  const { selectedWorkspace } = useSelectedWorkspace();
  const [activities, setActivities] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedWorkspace || !firebaseApp || !userId) return;

    const fetchActivity = async () => {
        setIsLoading(true);
        try {
            const functions = getFunctions(firebaseApp);
            const getUserActivity = httpsCallable(functions, 'getUserActivity');
            const result = await getUserActivity({
                workspaceId: selectedWorkspace.id,
                targetUserId: userId
            });
            setActivities(result.data as Notification[]);
        } catch (error) {
            console.error("Failed to fetch user activity from backend:", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchActivity();
  }, [selectedWorkspace, firebaseApp, userId]);

  if (isLoading) return (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}
    </div>
  );

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
      {activities.map((activity) => {
        const dateToDisplay = convertFirestoreTimestampToDate(activity.timestamp);

        return (
          <div key={activity.id} className="flex items-start gap-3 group">
            <div className="mt-1 bg-background border rounded-full p-1.5 shadow-sm">
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 space-y-0.5">
              <p className="text-xs leading-relaxed">
                <span className="font-bold">{activity.actorName}</span>
                {' '}{getSimplifiedActionText(activity, userId)}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {dateToDisplay && (
                  <span className="text-[10px] text-muted-foreground font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                    {format(dateToDisplay, 'MMM dd, yyyy HH:mm')}
                  </span>
                )}
                {activity.context?.companyName && activity.context.companyName !== 'Unknown Company' && (
                  <span className="text-[10px] text-muted-foreground font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                    Company: {activity.context.companyName}
                  </span>
                )}
                {activity.context?.projectName && activity.context.projectName !== 'Unknown Project' && activity.context.projectName !== 'Quick Tasks' && (
                  <span className="text-[10px] text-muted-foreground font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                    Project: {activity.context.projectName}
                  </span>
                )}
                {activity.context?.siloName && activity.context.siloName !== 'Inbox' && (
                  <span className="text-[10px] text-muted-foreground font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                    Silo: {activity.context.siloName}
                  </span>
                )}
                {activity.type === 'comment_added' && activity.context?.commentText && (
                  <span className="text-[10px] text-muted-foreground font-medium bg-secondary/50 px-2 py-0.5 rounded-full">
                    Comment: '{activity.context.commentText}'
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
