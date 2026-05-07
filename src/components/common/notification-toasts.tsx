'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, getDoc, getDocs,
} from 'firebase/firestore';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore } from '@/firebase';
import type { Notification } from '@/lib/types';
import {
  X, MessageSquare, UserPlus, CheckCircle2, Trash2,
  Folder, Box, Building2, FileText, Send, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useRouter } from 'next/navigation';

// ─── type style config ────────────────────────────────────────────────────────

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
  const b = (s?: string | null) => <span className="font-semibold">{s}</span>;
  switch (n.type) {
    case 'comment_added':   return <>{b(n.actorName)} commented on {b(n.target.name)}</>;
    case 'task_assigned':   return <>{b(n.actorName)} assigned {b(n.target.name)} to {b(n.assignee?.name)}</>;
    case 'task_completed':  return <>{b(n.actorName)} completed {b(n.target.name)}</>;
    case 'task_deleted':    return <>{b(n.actorName)} deleted task {b(n.target.name)}</>;
    case 'project_added':   return <>{b(n.actorName)} created project {b(n.target.name)}</>;
    case 'company_added':   return <>{b(n.actorName)} added company {b(n.target.name)}</>;
    case 'sale_added':      return <>{b(n.actorName)} logged a sale: {b(n.target.name)}</>;
    default:                return <>{b(n.actorName)} made a change in the workspace</>;
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
    setTimeout(() => onDismiss(n.id), 260);
  }, [n.id, onDismiss]);

  // Clicking the card body navigates to the task
  const handleNavigate = useCallback(() => {
    if (n.target.path) router.push(n.target.path);
  }, [n.target.path, router]);

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

  const handleSendReply = async () => {
    if (!replyText.trim() || !user || !selectedWorkspace) return;

    const match = n.target.path.match(/\/company\/([^/]+)\/project\/([^/]+)/);
    if (!match) { handleNavigate(); return; }
    const [, companyId, projectId] = match;
    const taskId = n.target.id;

    setIsSending(true);
    try {
      const siloId = await resolveSiloId(companyId, projectId, taskId);

      if (!siloId) {
        // Cannot locate the task in Firestore — navigate as fallback
        handleNavigate();
        handleDismiss();
        return;
      }

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
    <div
      className={cn(
        'w-[360px] rounded-xl border-l-[3px] shadow-2xl',
        'bg-background/97 backdrop-blur-xl border border-border/70',
        style.borderColor,
        'transition-all duration-260 ease-out',
        isExiting
          ? 'opacity-0 translate-x-3 scale-[0.96]'
          : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-4 fade-in duration-300',
      )}
    >
      {/* ── header row ── */}
      <div className="flex items-start gap-3 p-3 pb-2 pr-2">
        {/* type icon */}
        <div className={cn(
          'mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
          style.iconBg, style.iconColor,
        )}>
          {style.icon}
        </div>

        {/* main text — click navigates to the task */}
        <div
          className="flex-1 min-w-0 cursor-pointer group"
          onClick={handleNavigate}
          title="Click to open task"
        >
          <p className="text-[13px] leading-snug text-foreground group-hover:text-primary transition-colors">
            {getToastBody(n)}
          </p>
          {n.type === 'comment_added' && n.context?.commentText && (
            <p className="mt-1 text-[12px] text-muted-foreground italic line-clamp-2 leading-relaxed">
              "{n.context.commentText}"
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">{timeStr}</p>
        </div>

        {/* dismiss X */}
        <button
          onClick={handleDismiss}
          className="mt-0.5 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── action buttons (comment notifications only) ── */}
      {n.type === 'comment_added' && !isReplying && (
        <div className="flex gap-2 px-3 pb-3">
          <Button
            size="sm"
            className="h-8 flex-1 gap-1.5 text-xs font-medium"
            onClick={e => { e.stopPropagation(); setIsReplying(true); }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Reply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 gap-1.5 text-xs font-medium"
            onClick={handleNavigate}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Task
          </Button>
        </div>
      )}

      {/* ── inline reply form ── */}
      {isReplying && (
        <div className="px-3 pb-3">
          <Textarea
            autoFocus
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply… (Ctrl+Enter to send)"
            rows={2}
            className="text-sm resize-none bg-muted/30"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendReply();
              }
              if (e.key === 'Escape') {
                setIsReplying(false);
                setReplyText('');
              }
            }}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-muted-foreground">Ctrl+Enter to send</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setIsReplying(false); setReplyText(''); }}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSending}
              >
                <Send className="h-3 w-3" />
                {isSending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── helper: personal relevance ───────────────────────────────────────────────

function isPersonallyRelevant(notif: Notification, uid: string): boolean {
  if (notif.actorUid === uid) return false;
  switch (notif.type) {
    case 'task_assigned':  return notif.assignee?.uid === uid;
    case 'comment_added':  return Array.isArray(notif.isRelevantTo) && notif.isRelevantTo.includes(uid);
    case 'task_completed': return Array.isArray(notif.isRelevantTo) && notif.isRelevantTo.includes(uid);
    default:               return false;
  }
}

// ─── toast stack manager ──────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

export function NotificationToasts() {
  const [toasts, setToasts] = useState<Notification[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const currentUid = useRef<string>('');

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

      const fresh: Notification[] = [];
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const d = change.doc;
        if (seenIds.current.has(d.id)) return;
        seenIds.current.add(d.id);

        const notif = { id: d.id, ...d.data() } as Notification;
        if (isPersonallyRelevant(notif, uid)) {
          fresh.push(notif);
        }
      });

      if (fresh.length > 0) {
        setToasts(prev => [...fresh, ...prev]);
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

  if (toasts.length === 0) return null;

  const visible = toasts.slice(0, MAX_VISIBLE);
  const overflow = toasts.length - visible.length;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {/* clear-all bar — shown whenever there are multiple toasts */}
      {toasts.length > 1 && (
        <div className="pointer-events-auto w-[360px] flex items-center justify-between px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur border border-border/50 shadow-sm">
          <span className="text-[11px] text-muted-foreground font-medium">
            {toasts.length} notification{toasts.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleClearAll}
            className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* overflow pill when there are > MAX_VISIBLE toasts */}
      {overflow > 0 && (
        <div className="pointer-events-auto w-[360px]">
          <div className="rounded-xl bg-muted/50 backdrop-blur border border-border/40 px-4 py-2.5 text-center">
            <span className="text-[12px] text-muted-foreground font-medium">
              +{overflow} more — press <span className="font-bold text-foreground/70">Clear all</span> to dismiss
            </span>
          </div>
        </div>
      )}

      {/* visible toast cards */}
      {visible.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard notification={t} onDismiss={handleDismiss} />
        </div>
      ))}
    </div>
  );
}
