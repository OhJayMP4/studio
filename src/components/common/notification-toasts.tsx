'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, getDoc, getDocs,
} from 'firebase/firestore';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore } from '@/firebase';
import type { Notification as AppNotification } from '@/lib/types';
import type { Task } from '@/lib/types';
import { X, MessageSquare, Send, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { TaskDetailsDialog } from './task-details-dialog';

// ─── type style config ────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
];

function avatarColor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── single toast card ────────────────────────────────────────────────────────

interface ToastCardProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}

function ToastCard({ notification: n, onDismiss }: ToastCardProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [taskDialogData, setTaskDialogData] = useState<{ task: Task; path: string } | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const color = avatarColor(n.actorUid || n.actorName || 'x');
  const initials = (n.actorName || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(n.id), 260);
  }, [n.id, onDismiss]);

  // Find siloId: first try notification context, then search silos in Firestore.
  // Old notifications (before cloud function redeployment) don't have siloId in
  // context, so we fall back to scanning silos under the project.
  const resolveSiloId = useCallback(async (
    companyId: string,
    projectId: string,
    taskId: string,
  ): Promise<string | null> => {
    if (n.context?.siloId) return n.context.siloId;
    if (!selectedWorkspace) return null;

    try {
      const silosSnap = await getDocs(
        collection(firestore, `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos`),
      );
      for (const siloDoc of silosSnap.docs) {
        const taskSnap = await getDoc(
          doc(firestore, `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos/${siloDoc.id}/tasks/${taskId}`),
        );
        if (taskSnap.exists()) return siloDoc.id;
      }
    } catch (e) {
      console.error('Failed to resolve siloId:', e);
    }
    return null;
  }, [n.context?.siloId, selectedWorkspace, firestore]);

  const handleOpenTask = useCallback(async () => {
    if (!selectedWorkspace) return;
    const match = n.target.path.match(/\/company\/([^/]+)\/project\/([^/]+)/);
    if (!match) return;
    const [, companyId, projectId] = match;
    const taskId = n.target.id;

    setIsLoadingTask(true);
    try {
      const siloId = await resolveSiloId(companyId, projectId, taskId);
      if (!siloId) return;
      const taskPath = `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${taskId}`;
      const taskSnap = await getDoc(doc(firestore, taskPath));
      if (!taskSnap.exists()) return;
      const task = { id: taskSnap.id, ...taskSnap.data() } as Task;
      setTaskDialogData({ task, path: taskPath });
      setTaskDialogOpen(true);
    } catch (e) {
      console.error('Failed to open task:', e);
    } finally {
      setIsLoadingTask(false);
    }
  }, [n.target.path, n.target.id, selectedWorkspace, firestore, resolveSiloId]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !user || !selectedWorkspace) return;

    const match = n.target.path.match(/\/company\/([^/]+)\/project\/([^/]+)/);
    if (!match) return;
    const [, companyId, projectId] = match;
    const taskId = n.target.id;

    setIsSending(true);
    try {
      const siloId = await resolveSiloId(companyId, projectId, taskId);
      if (!siloId) return;

      const commentsPath = `workspaces/${selectedWorkspace.id}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${taskId}/comments`;
      await addDoc(collection(firestore, commentsPath), {
        text: replyText,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        author: { name: user.displayName || 'Unknown', avatarUrl: user.photoURL ?? null },
      });

      setReplyText('');
      setIsReplying(false);
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
    <>
    {taskDialogData && (
      <TaskDetailsDialog
        task={taskDialogData.task}
        path={taskDialogData.path}
        open={taskDialogOpen}
        onOpenChange={v => { setTaskDialogOpen(v); if (!v) setTaskDialogData(null); }}
      >
        <span />
      </TaskDetailsDialog>
    )}
    <div
      className={cn(
        'w-[360px] rounded-2xl shadow-2xl overflow-hidden',
        'bg-background/95 backdrop-blur-xl border border-border/60',
        'transition-all duration-250 ease-out',
        isExiting
          ? 'opacity-0 translate-x-4 scale-[0.95]'
          : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-4 fade-in duration-300',
      )}
    >
      {/* ── main content ── */}
      <div
        className="flex items-start gap-3 px-4 pt-4 pb-3 cursor-pointer group"
        onClick={handleOpenTask}
      >
        {/* actor avatar */}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={n.actorAvatarUrl ?? undefined} />
          <AvatarFallback className={cn('text-white text-xs font-bold', color)}>
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* 3-line hierarchy */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[14px] font-bold leading-tight text-foreground truncate">
              {n.actorName || 'Someone'}
            </span>
            <span className="text-[11px] text-muted-foreground/70 shrink-0 mt-0.5">{timeStr}</span>
          </div>
          <p className="text-[12px] font-medium text-muted-foreground truncate mt-0.5 group-hover:text-foreground/70 transition-colors">
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

        {/* dismiss X */}
        <button
          onClick={e => { e.stopPropagation(); handleDismiss(); }}
          className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* ── reply form (shown when replying) ── */}
      {isReplying ? (
        <div className="px-4 pb-4">
          <Textarea
            autoFocus
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            className="text-sm resize-none bg-muted/40 border-border/50"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSendReply(); }
              if (e.key === 'Escape') { setIsReplying(false); setReplyText(''); }
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setIsReplying(false); setReplyText(''); }} disabled={isSending}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSendReply} disabled={!replyText.trim() || isSending}>
              <Send className="h-3 w-3" />
              {isSending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        /* ── action bar ── */
        <div className="flex border-t border-border/40">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            onClick={e => { e.stopPropagation(); setIsReplying(true); }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Reply
          </button>
          <div className="w-px bg-border/40" />
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40"
            onClick={handleOpenTask}
            disabled={isLoadingTask}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {isLoadingTask ? 'Opening…' : 'Open'}
          </button>
        </div>
      )}
    </div>
    </>
  );
}

// ─── helper: personal relevance ───────────────────────────────────────────────

function isPersonallyRelevant(notif: AppNotification, uid: string): boolean {
  // Pop-up toasts are only for comments — direct user-to-user communication.
  if (notif.type !== 'comment_added') return false;
  if (notif.actorUid === uid) return false;
  return Array.isArray(notif.isRelevantTo) && notif.isRelevantTo.includes(uid);
}

// ─── toast stack manager ──────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

function useBrowserNotificationPermission() {
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);
}

function fireBrowserNotification(n: AppNotification) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // already on screen
  try {
    new Notification(n.actorName || 'New message', {
      body: n.context?.commentText || `Commented on ${n.target.name}`,
      tag: n.id, // deduplicates if same notification fires twice
    });
  } catch {}
}

export function NotificationToasts() {
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const currentUid = useRef<string>('');

  useBrowserNotificationPermission();

  const { selectedWorkspace } = useSelectedWorkspace();
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    currentUid.current = user?.uid ?? '';
  }, [user?.uid]);

  useEffect(() => {
    if (!selectedWorkspace?.id || !user?.uid) return;

    seenIds.current = new Set();
    let isFirstSnapshot = true;

    const q = query(
      collection(firestore, `notifications/${selectedWorkspace.id}/activities`),
      orderBy('timestamp', 'desc'),
      limit(30),
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      if (isFirstSnapshot) {
        snapshot.docs.forEach(d => seenIds.current.add(d.id));
        isFirstSnapshot = false;
        return;
      }

      const uid = currentUid.current;
      if (!uid) return;

      const fresh: AppNotification[] = [];
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const d = change.doc;
        if (seenIds.current.has(d.id)) return;
        seenIds.current.add(d.id);

        const notif = { id: d.id, ...d.data() } as AppNotification;
        if (isPersonallyRelevant(notif, uid)) {
          fresh.push(notif);
        }
      });

      if (fresh.length > 0) {
        setToasts(prev => [...fresh, ...prev]);
        fresh.forEach(fireBrowserNotification);
      }
    });

    return () => {
      unsubscribe();
      setToasts([]);
      isFirstSnapshot = true;
    };
  }, [selectedWorkspace?.id, user?.uid, firestore]);

  const handleDismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const [expanded, setExpanded] = useState(false);

  if (toasts.length === 0) return null;

  const PEEK_PX = 10;
  const SCALE_STEP = 0.04;
  const OPACITY_STEP = 0.15;
  const stack = toasts.slice(0, MAX_VISIBLE);
  const overflow = toasts.length - stack.length;

  // ── Expanded view: scrollable list of all toasts ──────────────────────────
  if (expanded) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] w-[380px] pointer-events-auto">
        <div className="rounded-2xl border border-border/60 shadow-2xl bg-background/97 backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
            <span className="text-sm font-semibold">
              {toasts.length} notification{toasts.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearAll}
                className="text-[11px] font-semibold text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Collapse
              </button>
            </div>
          </div>
          <ScrollArea className="max-h-[520px]">
            <div className="p-3 space-y-2">
              {toasts.map(t => (
                <ToastCard key={t.id} notification={t} onDismiss={handleDismiss} />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  // ── Stacked view ──────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none">
      {/* Physical stack — newest card at index 0 is on top */}
      <div
        className="relative"
        style={{ paddingBottom: `${(stack.length - 1) * PEEK_PX}px` }}
      >
        {[...stack].reverse().map((t, revIdx) => {
          const depth = stack.length - 1 - revIdx; // 0 = front
          const isFront = depth === 0;
          return (
            <div
              key={t.id}
              style={{
                position: isFront ? 'relative' : 'absolute',
                top: isFront ? undefined : `${depth * PEEK_PX}px`,
                left: 0, right: 0,
                zIndex: MAX_VISIBLE - depth,
                transform: `scale(${1 - depth * SCALE_STEP})`,
                transformOrigin: 'top center',
                opacity: 1 - depth * OPACITY_STEP,
                pointerEvents: isFront ? 'auto' : 'none',
              }}
              className="pointer-events-auto"
            >
              <ToastCard notification={t} onDismiss={handleDismiss} />
            </div>
          );
        })}
      </div>

      {/* Bottom bar: count + expand + clear all */}
      {toasts.length > 1 && (
        <div className="pointer-events-auto flex items-center justify-between mt-2 px-4 py-2 rounded-xl bg-background/80 backdrop-blur border border-border/50 shadow-sm w-[360px]">
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            {toasts.length} messages{overflow > 0 ? ` · +${overflow} more` : ''}
          </button>
          <button
            onClick={handleClearAll}
            className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
