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
  Bell, X, CheckCircle2, Trash2, MessageSquare,
  UserPlus, Folder, Box, Building2, FileText,
  Send, ArrowRight, Inbox, CheckCheck,
} from 'lucide-react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection, query, orderBy, limit, doc,
  arrayUnion, updateDoc, addDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';

// ─── type style config ────────────────────────────────────────────────────────

type TypeCfg = { icon: React.ReactNode; iconBg: string; iconColor: string; borderColor: string };

const typeCfg: Record<Notification['type'], TypeCfg> = {
  comment_added:   { icon: <MessageSquare className="h-3.5 w-3.5" />, iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-500',    borderColor: 'border-l-blue-500/70' },
  task_assigned:   { icon: <UserPlus      className="h-3.5 w-3.5" />, iconBg: 'bg-violet-500/15',  iconColor: 'text-violet-500',  borderColor: 'border-l-violet-500/70' },
  task_completed:  { icon: <CheckCircle2  className="h-3.5 w-3.5" />, iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-500', borderColor: 'border-l-emerald-500/70' },
  task_deleted:    { icon: <Trash2        className="h-3.5 w-3.5" />, iconBg: 'bg-red-500/15',     iconColor: 'text-red-500',     borderColor: 'border-l-red-500/70' },
  silo_added:      { icon: <Box           className="h-3.5 w-3.5" />, iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-500',   borderColor: 'border-l-amber-500/70' },
  silo_deleted:    { icon: <Trash2        className="h-3.5 w-3.5" />, iconBg: 'bg-red-500/15',     iconColor: 'text-red-500',     borderColor: 'border-l-red-500/70' },
  project_added:   { icon: <Folder        className="h-3.5 w-3.5" />, iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-500',   borderColor: 'border-l-amber-500/70' },
  project_deleted: { icon: <Trash2        className="h-3.5 w-3.5" />, iconBg: 'bg-red-500/15',     iconColor: 'text-red-500',     borderColor: 'border-l-red-500/70' },
  company_added:   { icon: <Building2     className="h-3.5 w-3.5" />, iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-500',   borderColor: 'border-l-amber-500/70' },
  company_deleted: { icon: <Trash2        className="h-3.5 w-3.5" />, iconBg: 'bg-red-500/15',     iconColor: 'text-red-500',     borderColor: 'border-l-red-500/70' },
  sale_added:      { icon: <FileText      className="h-3.5 w-3.5" />, iconBg: 'bg-teal-500/15',    iconColor: 'text-teal-500',    borderColor: 'border-l-teal-500/70' },
};

// ─── text ─────────────────────────────────────────────────────────────────────

function getNotificationText(n: Notification): React.ReactNode {
  const b = (s?: string) => <span className="font-semibold">{s}</span>;
  switch (n.type) {
    case 'comment_added':   return <>{b(n.actorName)} commented on {b(n.target.name)}</>;
    case 'task_assigned':   return <>{b(n.actorName)} assigned {b(n.target.name)} to {b(n.assignee?.name)}</>;
    case 'task_completed':  return <>{b(n.actorName)} completed {b(n.target.name)}</>;
    case 'task_deleted':    return <>{b(n.actorName)} deleted task {b(n.target.name)}</>;
    case 'project_added':   return <>{b(n.actorName)} created project {b(n.target.name)}</>;
    case 'project_deleted': return <>{b(n.actorName)} deleted project {b(n.target.name)}</>;
    case 'company_added':   return <>{b(n.actorName)} added company {b(n.target.name)}</>;
    case 'company_deleted': return <>{b(n.actorName)} deleted company {b(n.target.name)}</>;
    case 'silo_added':      return <>{b(n.actorName)} added silo {b(n.target.name)}</>;
    case 'silo_deleted':    return <>{b(n.actorName)} deleted silo {b(n.target.name)}</>;
    case 'sale_added':      return <>{b(n.actorName)} logged a sale: {b(n.target.name)}</>;
    default:                return <>{b(n.actorName)} made a change</>;
  }
}

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

  // personal = relevant to me AND not sent by me AND unread
  const personal = useMemo(() => {
    if (!data || !user) return [];
    return data.filter(n =>
      Array.isArray(n.isRelevantTo) &&
      n.isRelevantTo.includes(user.uid) &&
      n.actorUid !== user.uid &&
      !n.readBy.includes(user.uid),
    );
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
  onBodyClick: (n: Notification) => void;
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
  onBodyClick,
}: CardProps) {
  const cfg = typeCfg[n.type] ?? typeCfg.comment_added;

  return (
    <div className={cn(
      'mx-2 my-1 rounded-xl border-l-[3px]',
      'bg-primary/[0.03] hover:bg-primary/[0.06] transition-colors',
      cfg.borderColor,
    )}>
      {/* main row */}
      <div className="flex items-start gap-3 px-3 pt-3 pb-2">
        {/* actor avatar */}
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarFallback className={cn('text-[10px] font-bold', cfg.iconBg, cfg.iconColor)}>
            {initials(n.actorName || '?')}
          </AvatarFallback>
        </Avatar>

        {/* content — clickable to navigate */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onBodyClick(n)}
        >
          <p className="text-[13px] leading-snug text-foreground">{getNotificationText(n)}</p>
          {n.type === 'comment_added' && n.context?.commentText && (
            <p className="mt-1 text-[12px] text-muted-foreground italic line-clamp-2 leading-relaxed">
              "{n.context.commentText}"
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.iconBg, cfg.iconColor)}>
              {cfg.icon}
            </span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(n)}</span>
            {n.type === 'comment_added' && (
              <button
                className={cn(
                  'text-[11px] font-medium transition-colors ml-1',
                  isReplying ? 'text-primary' : 'text-muted-foreground hover:text-primary',
                )}
                onClick={e => { e.stopPropagation(); onToggleReply(n); }}
              >
                {isReplying ? 'Replying…' : '↩ Reply'}
              </button>
            )}
            {/* unread dot */}
            <span className="ml-auto h-2 w-2 rounded-full bg-blue-500 shrink-0" />
          </div>
        </div>

        {/* X dismiss */}
        <button
          onClick={() => onDismiss(n)}
          className="mt-0.5 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* inline reply form */}
      {isReplying && (
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
      )}
    </div>
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

  // X pressed — mark as read (removes from personal unread list)
  const handleDismiss = useCallback((n: Notification) => {
    markRead(n.id);
    if (replyingTo === n.id) setReplyingTo(null);
  }, [markRead, replyingTo]);

  // Body click — navigate; for comments, toggle reply form
  const handleBodyClick = useCallback((n: Notification) => {
    if (n.type === 'comment_added') {
      setReplyingTo(prev => prev === n.id ? null : n.id);
      setReplyText('');
    } else if (n.target.path) {
      router.push(n.target.path);
    }
  }, [router]);

  const handleToggleReply = useCallback((n: Notification) => {
    setReplyingTo(prev => prev === n.id ? null : n.id);
    setReplyText('');
  }, []);

  const handleSendReply = useCallback(async (n: Notification) => {
    if (!replyText.trim() || !user || !selectedWorkspace) return;
    const match = n.target.path.match(/\/company\/([^/]+)\/project\/([^/]+)/);
    if (!match) { router.push(n.target.path); return; }
    const [, companyId, projectId] = match;
    const siloId = n.context?.siloId;
    if (!siloId) { router.push(n.target.path); return; }

    setIsSendingReply(true);
    try {
      const path = `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${n.target.id}/comments`;
      await addDoc(collection(firestore, path), {
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
  }, [replyText, user, selectedWorkspace, firestore, markRead, router]);

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
    onBodyClick: handleBodyClick,
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
                You'll get notifications here when someone assigns you a task, comments, or mentions you.
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
