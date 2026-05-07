'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, arrayUnion, updateDoc,
} from 'firebase/firestore';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore } from '@/firebase';
import type { Notification } from '@/lib/types';
import {
  X, MessageSquare, UserPlus, CheckCircle2, Trash2,
  Folder, Box, Building2, FileText, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useRouter } from 'next/navigation';

// ─── type colours (same palette as notifications.tsx) ────────────────────────

const typeStyle: Record<string, { iconBg: string; iconColor: string; borderColor: string; icon: React.ReactNode }> = {
  comment_added:   { icon: <MessageSquare className="h-4 w-4" />, iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-500',    borderColor: 'border-l-blue-500' },
  task_assigned:   { icon: <UserPlus      className="h-4 w-4" />, iconBg: 'bg-violet-500/15',  iconColor: 'text-violet-500',  borderColor: 'border-l-violet-500' },
  task_completed:  { icon: <CheckCircle2  className="h-4 w-4" />, iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-500', borderColor: 'border-l-emerald-500' },
  task_deleted:    { icon: <Trash2        className="h-4 w-4" />, iconBg: 'bg-red-500/15',     iconColor: 'text-red-500',     borderColor: 'border-l-red-500' },
  project_added:   { icon: <Folder        className="h-4 w-4" />, iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-500',   borderColor: 'border-l-amber-500' },
  project_deleted: { icon: <Trash2        className="h-4 w-4" />, iconBg: 'bg-red-500/15',     iconColor: 'text-red-500',     borderColor: 'border-l-red-500' },
  company_added:   { icon: <Building2     className="h-4 w-4" />, iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-500',   borderColor: 'border-l-amber-500' },
  company_deleted: { icon: <Trash2        className="h-4 w-4" />, iconBg: 'bg-red-500/15',     iconColor: 'text-red-500',     borderColor: 'border-l-red-500' },
  silo_added:      { icon: <Box           className="h-4 w-4" />, iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-500',   borderColor: 'border-l-amber-500' },
  silo_deleted:    { icon: <Trash2        className="h-4 w-4" />, iconBg: 'bg-red-500/15',     iconColor: 'text-red-500',     borderColor: 'border-l-red-500' },
  sale_added:      { icon: <FileText      className="h-4 w-4" />, iconBg: 'bg-teal-500/15',    iconColor: 'text-teal-500',    borderColor: 'border-l-teal-500' },
};

const fallbackStyle = typeStyle.comment_added;

function getToastBody(n: Notification): React.ReactNode {
  switch (n.type) {
    case 'comment_added':
      return <><span className="font-semibold">{n.actorName}</span> commented on <span className="font-semibold">{n.target.name}</span></>;
    case 'task_assigned':
      return <><span className="font-semibold">{n.actorName}</span> assigned <span className="font-semibold">{n.target.name}</span> to <span className="font-semibold">{n.assignee?.name}</span></>;
    case 'task_completed':
      return <><span className="font-semibold">{n.actorName}</span> completed <span className="font-semibold">{n.target.name}</span></>;
    case 'task_deleted':
      return <><span className="font-semibold">{n.actorName}</span> deleted task <span className="font-semibold">{n.target.name}</span></>;
    case 'project_added':
      return <><span className="font-semibold">{n.actorName}</span> created project <span className="font-semibold">{n.target.name}</span></>;
    case 'company_added':
      return <><span className="font-semibold">{n.actorName}</span> added company <span className="font-semibold">{n.target.name}</span></>;
    case 'sale_added':
      return <><span className="font-semibold">{n.actorName}</span> logged a sale: <span className="font-semibold">{n.target.name}</span></>;
    default:
      return <><span className="font-semibold">{n.actorName}</span> made a change in the workspace</>;
  }
}

// ─── single toast card ────────────────────────────────────────────────────────

interface ToastCardProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

function ToastCard({ notification: n, onDismiss }: ToastCardProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const router = useRouter();

  const style = typeStyle[n.type] ?? fallbackStyle;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(n.id), 280);
  }, [n.id, onDismiss]);

  const handleBodyClick = () => {
    if (n.type === 'comment_added') {
      setIsReplying(r => !r);
    } else if (n.target.path) {
      router.push(n.target.path);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !user || !selectedWorkspace) return;
    const match = n.target.path.match(/\/company\/([^/]+)\/project\/([^/]+)/);
    if (!match) return;
    const [, companyId, projectId] = match;
    const siloId = n.context?.siloId;
    if (!siloId) { router.push(n.target.path); handleDismiss(); return; }

    setIsSending(true);
    try {
      const path = `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${n.target.id}/comments`;
      await addDoc(collection(firestore, path), {
        text: replyText,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        author: { name: user.displayName || 'Unknown', avatarUrl: user.photoURL ?? null },
      });
      handleDismiss();
    } catch (e) {
      console.error('Failed to post reply:', e);
    } finally {
      setIsSending(false);
    }
  };

  const timeStr = n.timestamp
    ? formatDistanceToNow(new Date(n.timestamp.seconds * 1000), { addSuffix: true })
    : '';

  return (
    <div
      className={cn(
        'w-[360px] rounded-xl border-l-[3px] shadow-2xl',
        'bg-background/95 backdrop-blur-xl border border-border/60',
        style.borderColor,
        'transition-all duration-280 ease-out',
        isExiting
          ? 'opacity-0 translate-x-4 scale-95'
          : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-4 fade-in duration-300',
      )}
    >
      {/* main row */}
      <div className="flex items-start gap-3 p-3 pr-2">
        {/* icon */}
        <div className={cn('mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0', style.iconBg, style.iconColor)}>
          {style.icon}
        </div>

        {/* content */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={handleBodyClick}
        >
          <p className="text-[13px] leading-snug text-foreground">{getToastBody(n)}</p>
          {n.type === 'comment_added' && n.context?.commentText && (
            <p className="mt-1 text-[12px] text-muted-foreground italic line-clamp-2 leading-relaxed">
              "{n.context.commentText}"
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-muted-foreground">{timeStr}</span>
            {n.type === 'comment_added' && (
              <span className={cn('text-[11px] font-medium', isReplying ? 'text-primary' : 'text-muted-foreground')}>
                {isReplying ? 'Replying…' : '↩ Reply'}
              </span>
            )}
          </div>
        </div>

        {/* dismiss */}
        <button
          onClick={handleDismiss}
          className="mt-0.5 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* inline reply */}
      {isReplying && (
        <div className="px-3 pb-3 pt-0">
          <Textarea
            autoFocus
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            className="text-sm resize-none bg-muted/30"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSendReply(); }
              if (e.key === 'Escape') setIsReplying(false);
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsReplying(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSendReply} disabled={!replyText.trim() || isSending}>
              <Send className="h-3 w-3" />
              {isSending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── toast manager (exported — rendered in layout) ────────────────────────────

export function NotificationToasts() {
  const [toasts, setToasts] = useState<Notification[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const { selectedWorkspace } = useSelectedWorkspace();
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if (!selectedWorkspace?.id || !user?.uid) return;

    // Reset on workspace change
    seenIds.current = new Set();
    initialLoadDone.current = false;

    const q = query(
      collection(firestore, `notifications/${selectedWorkspace.id}/activities`),
      orderBy('timestamp', 'desc'),
      limit(20),
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      if (!initialLoadDone.current) {
        snapshot.docs.forEach(d => seenIds.current.add(d.id));
        initialLoadDone.current = true;
        return;
      }

      const fresh: Notification[] = [];
      snapshot.docs.forEach(d => {
        if (!seenIds.current.has(d.id)) {
          seenIds.current.add(d.id);
          const notif = { id: d.id, ...d.data() } as Notification;
          // Only toast for relevant events that weren't triggered by the current user
          if (
            Array.isArray(notif.isRelevantTo) &&
            notif.isRelevantTo.includes(user.uid) &&
            notif.actorUid !== user.uid
          ) {
            fresh.push(notif);
          }
        }
      });

      if (fresh.length > 0) {
        setToasts(prev => [...fresh, ...prev]);
      }
    });

    return () => {
      unsubscribe();
      setToasts([]);
    };
  }, [selectedWorkspace?.id, user?.uid, firestore]);

  const handleDismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  // Show max 4 stacked toasts; the rest are hidden but tracked
  const visible = toasts.slice(0, 4);
  const hiddenCount = toasts.length - visible.length;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2 items-end pointer-events-none">
      {hiddenCount > 0 && (
        <div className="pointer-events-auto">
          <button
            onClick={() => setToasts([])}
            className="text-[11px] font-medium text-muted-foreground bg-background/80 backdrop-blur border rounded-full px-3 py-1 shadow-md hover:text-foreground transition-colors"
          >
            +{hiddenCount} more · dismiss all
          </button>
        </div>
      )}
      {visible.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard notification={t} onDismiss={handleDismiss} />
        </div>
      ))}
    </div>
  );
}
