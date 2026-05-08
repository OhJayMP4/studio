'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import type { UserTask } from '@/lib/types';
import { saturnChat, type SaturnMessage } from '@/ai/flows/saturn-chat-flow';
import { cn } from '@/lib/utils';
import { Orbit, Send, Loader2, X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import { format, isPast, isToday } from 'date-fns';
import { useRouter } from 'next/navigation';

// ─── compact message ──────────────────────────────────────────────────────────

function CompactMessage({ message, userName, userAvatar }: {
  message: SaturnMessage;
  userName: string;
  userAvatar?: string | null;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-2', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <Avatar className="h-6 w-6 shrink-0 mt-0.5">
          <AvatarImage src={userAvatar ?? undefined} />
          <AvatarFallback className="text-[9px] font-bold bg-primary text-primary-foreground">
            {userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-gradient-to-br from-violet-500 to-indigo-600">
          <Orbit className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      <div className={cn(
        'max-w-[82%] rounded-xl px-3 py-2 text-[13px] leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-muted/70 border border-border/40 rounded-tl-sm',
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5 prose-ul:my-0.5 prose-li:my-0 prose-strong:font-semibold [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function SaturnFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SaturnMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const { user } = useUser();
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const firestore = useFirestore();

  const tasksQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, `user-tasks/${user.uid}/tasks`), orderBy('dueDate', 'asc'));
  }, [firestore, user]);
  const { data: myTasks } = useCollection<UserTask>(tasksQuery);

  const [teamMembers, setTeamMembers] = useState<Array<{ name: string; totalTasks: number; completedTasks: number; overdueTasks: number }>>([]);

  useEffect(() => {
    if (!isOpen || !isUserAdmin || !selectedWorkspace || !firestore) return;
    const users = Object.entries(selectedWorkspace.users || {});
    Promise.all(
      users.map(async ([uid, u]) => {
        try {
          const snap = await getDocs(collection(firestore, `user-tasks/${uid}/tasks`));
          const tasks = snap.docs.map(d => d.data() as UserTask);
          return {
            name: (u as any).name || (u as any).email || uid,
            totalTasks: tasks.filter(t => !t.completed).length,
            completedTasks: tasks.filter(t => t.completed).length,
            overdueTasks: tasks.filter(t => !t.completed && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))).length,
          };
        } catch { return null; }
      })
    ).then(r => setTeamMembers(r.filter(Boolean) as any[]));
  }, [isOpen, isUserAdmin, selectedWorkspace, firestore]);

  const companyNames = useMemo(() => {
    if (!selectedWorkspace) return [];
    return Object.values((selectedWorkspace as any).companies || {}).map((c: any) => c.name).filter(Boolean) as string[];
  }, [selectedWorkspace]);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 150);
  }, [isOpen]);

  const buildContext = () => ({
    userName: user?.displayName || user?.email || 'there',
    isAdmin: isUserAdmin,
    currentDate: format(new Date(), 'yyyy-MM-dd'),
    myTasks: (myTasks || []).map(t => ({
      title: t.title,
      status: t.status || (t.completed ? 'completed' : 'todo'),
      priority: t.priority,
      dueDate: t.dueDate,
      completed: t.completed,
      companyName: t.companyName,
      projectName: t.projectName,
    })),
    teamMembers: isUserAdmin ? teamMembers : undefined,
    companyNames,
  });

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMessage: SaturnMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    try {
      const response = await saturnChat({ messages: updatedMessages, context: buildContext() });
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'model', content: "Something went wrong. Please try again." }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const openFullPage = () => {
    setIsOpen(false);
    router.push('/saturn');
  };

  return (
    <>
      {/* ── floating trigger button ── */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={cn(
          'fixed bottom-6 left-6 z-[9998]',
          'h-14 w-14 rounded-2xl',
          'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700',
          'shadow-xl shadow-violet-500/40',
          'flex items-center justify-center',
          'transition-all duration-200',
          'hover:scale-105 hover:shadow-2xl hover:shadow-violet-500/50',
          'active:scale-95',
          isOpen && 'scale-95 opacity-0 pointer-events-none',
        )}
        aria-label="Open Saturn AI"
      >
        <Orbit className="h-6 w-6 text-white" />
        {/* pulse ring */}
        <span className="absolute inset-0 rounded-2xl ring-2 ring-violet-400/40 animate-ping" />
      </button>

      {/* ── chat panel ── */}
      <div className={cn(
        'fixed bottom-6 left-6 z-[9998] w-[380px]',
        'rounded-2xl border border-border/60 shadow-2xl shadow-black/20',
        'bg-background/97 backdrop-blur-xl overflow-hidden',
        'flex flex-col',
        'transition-all duration-300 origin-bottom-left',
        isOpen
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-95 translate-y-4 pointer-events-none',
      )}>
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-gradient-to-r from-violet-500/8 to-indigo-500/8 shrink-0">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
            <Orbit className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-none">Saturn</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Workspace AI</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={openFullPage}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Open full page"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* messages */}
        <ScrollArea className="h-[360px]">
          <div className="p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/20">
                  <Orbit className="h-6 w-6 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Ask Saturn anything</p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                    Your tasks, your team, your portfolio — I know it all.
                  </p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <CompactMessage
                key={i}
                message={m}
                userName={user?.displayName || 'You'}
                userAvatar={user?.photoURL}
              />
            ))}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 shrink-0">
                  <Orbit className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-muted/70 border border-border/40 rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* input */}
        <div className="shrink-0 border-t border-border/50 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 focus-within:border-violet-500/40 transition-colors">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask something…"
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent p-0 text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 min-h-[20px] max-h-[80px]"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className={cn(
                'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all',
                'bg-gradient-to-br from-violet-500 to-indigo-600',
                'text-white disabled:opacity-30 disabled:cursor-not-allowed',
                'hover:from-violet-600 hover:to-indigo-700',
              )}
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
