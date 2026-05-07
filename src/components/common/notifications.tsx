'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  Bell, X, MessageSquare,
  Send, ArrowRight, Inbox, CheckCheck, ExternalLink,
} from 'lucide-react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, orderBy, limit, doc,
  arrayUnion, updateDoc, addDoc, serverTimestamp, writeBatch,
  getDoc, getDocs,
} from 'firebase/firestore';
import type { Notification, Task } from '@/lib/types';
import { TaskDetailsDialog } from './task-details-dialog';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

// ─── type style config (comments only) ───────────────────────────────────────

type TypeCfg = { iconBg: string; iconColor: string; borderColor: string };

const typeCfg: Partial<Record<Notification['type'], TypeCfg>> = {
  comment_added: { iconBg: 'bg-blue-500', iconColor: 'text-blue-500', borderColor: 'border-l-blue-500/70' },
};

function timeAgo(n: Notification) {
  if (!n.timestamp) return '';
  return formatDistanceToNow(new Date(n.timestamp.seconds * 1000), { addSuffix: true });
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── data hook ────────────────────────────────────────────────────────────────

function usePersonalNotifications() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const { user } = useUser();
  const firestore = useFirestore();

  const q = useMemoFirebase(() => {
    if (!selectedWorkspace || !user) return null;
    return query(
      collection(firestore, `notifications/${selectedWorkspace.id}/activities`),
      orderBy('timestamp', 'desc'),
      limit(50),
    );
  }, [firestore, selectedWorkspace, user]);

  const { data, isLoading } = useCollection<Notification>(q);

  // Personal = notifications directed at ME that I haven't dismissed yet.
  // We use type-specific rules so the bell works correctly for both
  // single-user workspaces (where actorUid === user.uid for most events)
  // and the intended multi-user case.
  const personal = useMemo(() => {
    if (!data || !user) return [];
    return data.filter(n => {
      if (n.readBy.includes(user.uid)) return false;
      // Bell shows ONLY comment notifications — pure user-to-user communication.
      // Everything else (task events, project/company/silo changes) lives in Activity Log.
      if (n.type !== 'comment_added') return false;
      if (n.actorUid === user.uid) return false;
      return Array.isArray(n.isRelevantTo) && n.isRelevantTo.includes(user.uid);
    });
  }, [data, user]);

  return { notifications: personal, isLoading, unreadCount: personal.length };
}

// ─── single notification card ─────────────────────────────────────────────────

interface CardProps {
  notification: Notification;
  isReplying: boolean;
  replyText: string;
  isSendingReply: boolean;
  onReplyTextChange: (v: string) => void;
  onDismiss: (n: Notification) => void;
  onToggleReply: (n: Notification) => void;
  onSendReply: (n: Notification) => void;
  onOpenTask: (n: Notification) => void;
  taskDialogData: { task: Task; path: string; notifId: string } | null;
  taskDialogOpen: boolean;
  onTaskDialogOpenChange: (v: boolean) => void;
}

function NotificationCard({
  notification: n,
  isReplying,
  replyText,
  isSendingReply,
  onReplyTextChange,
  onDismiss,
  onToggleReply,
  onSendReply,
  onOpenTask,
  taskDialogData,
  taskDialogOpen,
  onTaskDialogOpenChange,
}: CardProps) {
  return (
    <>
    {taskDialogData?.notifId === n.id && (
      <TaskDetailsDialog
        task={taskDialogData.task}
        path={taskDialogData.path}
        open={taskDialogOpen}
        onOpenChange={onTaskDialogOpenChange}
      >
        <span />
      </TaskDetailsDialog>
    )}
    <div className="mx-2 my-1 rounded-xl border-l-[3px] border-l-blue-500/70 overflow-hidden bg-primary/[0.03] hover:bg-primary/[0.05] transition-colors">
      {/* main row */}
      <div className="flex items-start gap-3 px-3 pt-3 pb-2">
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          <AvatarImage src={n.actorAvatarUrl ?? undefined} />
          <AvatarFallback className="text-[11px] font-bold text-white bg-blue-500">
            {initials(n.actorName || '?')}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] font-bold leading-tight text-foreground truncate">
              {n.actorName || 'Someone'}
            </span>
            <span className="text-[11px] text-muted-foreground/70 shrink-0">{timeAgo(n)}</span>
          </div>
          <p className="text-[12px] font-medium text-muted-foreground truncate mt-0.5">
            {n.target.name}
          </p>
          {n.context?.commentText ? (
            <p className="text-[13px] text-foreground/80 mt-1 line-clamp-2 leading-snug">
              {n.context.commentText}
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground/60 mt-1 italic">left a comment</p>
          )}
        </div>

        <button
          onClick={() => onDismiss(n)}
          className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* action bar or reply form */}
      {isReplying ? (
        <div className="px-3 pb-3" onClick={e => e.stopPropagation()}>
          <Textarea
            autoFocus
            value={replyText}
            onChange={e => onReplyTextChange(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            className="text-sm resize-none bg-background/60"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSendReply(n); }
              if (e.key === 'Escape') onToggleReply(n);
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onToggleReply(n)} disabled={isSendingReply}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => onSendReply(n)} disabled={!replyText.trim() || isSendingReply}>
              <Send className="h-3 w-3" />
              {isSendingReply ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex border-t border-border/30">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            onClick={e => { e.stopPropagation(); onToggleReply(n); }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Reply
          </button>
          <div className="w-px bg-border/30" />
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            onClick={e => { e.stopPropagation(); onOpenTask(n); }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Task
          </button>
        </div>
      )}
    </div>
    </>
  );
}

// ─── date group ───────────────────────────────────────────────────────────────

function dateLabel(n: Notification): string {
  if (!n.timestamp) return 'Earlier';
  const d = new Date(n.timestamp.seconds * 1000);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return 'Earlier';
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-1 p-2 pt-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="mx-2 rounded-xl border border-border/40 p-3 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-2.5 bg-muted/50 rounded w-1/4 mt-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [taskDialogData, setTaskDialogData] = useState<{ task: Task; path: string; notifId: string } | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const { notifications, isLoading, unreadCount } = usePersonalNotifications();
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const router = useRouter();

  const markRead = useCallback(async (id: string) => {
    if (!user || !selectedWorkspace) return;
    const ref = doc(firestore, `notifications/${selectedWorkspace.id}/activities/${id}`);
    await updateDoc(ref, { readBy: arrayUnion(user.uid) }).catch(console.error);
  }, [user, selectedWorkspace, firestore]);

  const handleMarkAllRead = async () => {
    if (!user || !selectedWorkspace || !notifications.length) return;
    const batch = writeBatch(firestore);
    notifications.forEach(n => {
      const ref = doc(firestore, `notifications/${selectedWorkspace.id}/activities/${n.id}`);
      batch.update(ref, { readBy: arrayUnion(user.uid) });
    });
    await batch.commit().catch(console.error);
  };

  // Resolve siloId: check context first, then scan silos in Firestore as fallback.
  const resolveSiloId = useCallback(async (
    n: Notification, companyId: string, projectId: string,
  ): Promise<string | null> => {
    if (n.context?.siloId) return n.context.siloId;
    if (!selectedWorkspace) return null;
    try {
      const silosSnap = await getDocs(
        collection(firestore, `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos`),
      );
      for (const siloDoc of silosSnap.docs) {
        const taskSnap = await getDoc(
          doc(firestore, `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos/${siloDoc.id}/tasks/${n.target.id}`),
        );
        if (taskSnap.exists()) return siloDoc.id;
      }
    } catch (e) {
      console.error('Failed to resolve siloId:', e);
    }
    return null;
  }, [selectedWorkspace, firestore]);

  const handleDismiss = useCallback((n: Notification) => {
    markRead(n.id);
    if (replyingTo === n.id) setReplyingTo(null);
  }, [markRead, replyingTo]);

  const handleToggleReply = useCallback((n: Notification) => {
    setReplyingTo(prev => prev === n.id ? null : n.id);
    setReplyText('');
  }, []);

  const handleOpenTask = useCallback(async (n: Notification) => {
    if (!selectedWorkspace) return;
    const match = n.target.path.match(/\/company\/([^/]+)\/project\/([^/]+)/);
    if (!match) return;
    const [, companyId, projectId] = match;
    try {
      const siloId = await resolveSiloId(n, companyId, projectId);
      if (!siloId) return;
      const taskPath = `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${n.target.id}`;
      const taskSnap = await getDoc(doc(firestore, taskPath));
      if (!taskSnap.exists()) return;
      const task = { id: taskSnap.id, ...taskSnap.data() } as Task;
      setTaskDialogData({ task, path: taskPath, notifId: n.id });
      setTaskDialogOpen(true);
      setIsOpen(false); // close the popover so the dialog has room
    } catch (e) {
      console.error('Failed to open task:', e);
    }
  }, [selectedWorkspace, firestore, resolveSiloId]);

  const handleSendReply = useCallback(async (n: Notification) => {
    if (!replyText.trim() || !user || !selectedWorkspace) return;
    const match = n.target.path.match(/\/company\/([^/]+)\/project\/([^/]+)/);
    if (!match) return;
    const [, companyId, projectId] = match;

    setIsSendingReply(true);
    try {
      const siloId = await resolveSiloId(n, companyId, projectId);
      if (!siloId) return;
      const commentsPath = `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${n.target.id}/comments`;
      await addDoc(collection(firestore, commentsPath), {
        text: replyText,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        author: { name: user.displayName || 'Unknown', avatarUrl: user.photoURL ?? null },
      });
      setReplyText('');
      setReplyingTo(null);
      markRead(n.id);
    } catch (e) {
      console.error('Failed to post reply:', e);
    } finally {
      setIsSendingReply(false);
    }
  }, [replyText, user, selectedWorkspace, firestore, markRead, resolveSiloId]);

  // group by date label
  const grouped = useMemo(() => {
    const map = new Map<string, Notification[]>();
    const order: string[] = [];
    notifications.forEach(n => {
      const label = dateLabel(n);
      if (!map.has(label)) { map.set(label, []); order.push(label); }
      map.get(label)!.push(n);
    });
    return order.map(label => ({ label, items: map.get(label)! }));
  }, [notifications]);

  const cardProps = {
    replyText,
    isSendingReply,
    onReplyTextChange: setReplyText,
    onDismiss: handleDismiss,
    onToggleReply: handleToggleReply,
    onSendReply: handleSendReply,
    onOpenTask: handleOpenTask,
    taskDialogData,
    taskDialogOpen,
    onTaskDialogOpenChange: (v: boolean) => { setTaskDialogOpen(v); if (!v) setTaskDialogData(null); },
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'relative flex items-center justify-center w-9 h-9 rounded-lg',
            'transition-colors duration-150',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isOpen && 'bg-accent',
          )}
          aria-label="Toggle notifications"
        >
          <Bell className={cn('h-5 w-5 transition-all', unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground')} />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
              'flex items-center justify-center',
              'text-[10px] font-bold text-white rounded-full',
              'bg-red-500 shadow-sm animate-in zoom-in-50 duration-200',
            )}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[400px] p-0 rounded-xl shadow-2xl border-border/80 overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>

        {/* hint */}
        {unreadCount > 0 && (
          <p className="px-4 py-2 text-[11px] text-muted-foreground border-b bg-muted/10">
            Press <span className="font-semibold">✕</span> on a notification to dismiss it.
          </p>
        )}

        {/* body */}
        <ScrollArea className="max-h-[460px]">
          {isLoading ? (
            <LoadingSkeleton />
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Inbox className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground/70">You're all caught up</p>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                You'll see messages here when someone comments on your tasks or mentions you.
              </p>
            </div>
          ) : (
            <div className="pb-1">
              {grouped.map(group => (
                <div key={group.label}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {group.label}
                  </p>
                  {group.items.map(n => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      isReplying={replyingTo === n.id}
                      {...cardProps}
                    />
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
            View notification history
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
