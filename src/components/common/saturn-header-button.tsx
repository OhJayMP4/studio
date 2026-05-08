'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { collection, query, orderBy, getDocs, getDoc, doc } from 'firebase/firestore';
import type { UserTask } from '@/lib/types';
import { saturnChat, type SaturnMessage } from '@/ai/flows/saturn-chat-flow';
import { parseSaturnResponse, executeSaturnAction, ACTION_LABELS, ACTION_ICONS, ACTION_FIELD_LABELS, type SaturnAction } from '@/lib/saturn-actions';
import { getWorkspaceMemory, getUserMemory, saveWorkspaceMemory, saveUserMemory, mergeMemory } from '@/lib/saturn-memory';
import { extractMemoryFromConversation } from '@/ai/flows/saturn-memory-flow';
import { SaturnMessageContent } from '@/components/saturn/saturn-rich-blocks';
import type { BlockContext, TeamMemberData } from '@/lib/saturn-blocks';
import { cn } from '@/lib/utils';
import { Orbit, Send, Loader2, X, Maximize2, CheckCircle2, XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ReactMarkdown from 'react-markdown';
import { format, isPast, isToday } from 'date-fns';
import { useRouter } from 'next/navigation';

function CompactMessage({ message, userName, userAvatar, blockCtx }: {
  message: SaturnMessage;
  userName: string;
  userAvatar?: string | null;
  blockCtx?: BlockContext;
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
        <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-primary">
          <Orbit className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      <div className={cn(
        'rounded-xl px-3 py-2 text-[13px] leading-relaxed',
        isUser
          ? 'max-w-[82%] bg-primary text-primary-foreground rounded-tr-sm'
          : 'flex-1 min-w-0 bg-muted/70 border border-border/40 rounded-tl-sm',
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : blockCtx ? (
          <SaturnMessageContent content={message.content} ctx={blockCtx} />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5 prose-ul:my-0.5 prose-li:my-0 prose-strong:font-semibold [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactActionCard({ action, onConfirm, onCancel, isLoading }: {
  action: SaturnAction;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const label = ACTION_LABELS[action.type];
  const icon = ACTION_ICONS[action.type];
  const fields = Object.entries(action.data)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ({ label: ACTION_FIELD_LABELS[k] || k, value: String(v) }));
  return (
    <div className="flex items-start gap-2">
      <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-primary">
        <Orbit className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 rounded-xl rounded-tl-sm border border-primary/30 bg-primary/5 p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          <span>{icon}</span>
          <span>{label}</span>
        </div>
        <div className="space-y-1">
          {fields.map(f => (
            <div key={f.label} className="flex gap-2 text-[12px]">
              <span className="text-muted-foreground w-16 shrink-0">{f.label}</span>
              <span className="text-foreground font-medium">{f.value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 h-7 rounded-lg border border-border/60 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-7 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-1"
          >
            {isLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Creating…</> : <>✓ {label}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SaturnHeaderButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SaturnMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<SaturnAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [workspaceMemory, setWorkspaceMemory] = useState<string[]>([]);
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const [userPatterns, setUserPatterns] = useState<string[]>([]);
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

  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [salesSummary, setSalesSummary] = useState<Array<{ companyName: string; projectName: string; totalSalesValue: number; status: string; deadline?: string }>>([]);

  useEffect(() => {
    if (!isOpen || !selectedWorkspace || !firestore) return;
    Promise.all(
      Object.keys(selectedWorkspace.users || {}).map(async uid => {
        try {
          const snap = await getDoc(doc(firestore, 'users', uid));
          return (snap.data()?.name as string | undefined) || null;
        } catch { return null; }
      })
    ).then(names => setMemberNames(names.filter(Boolean) as string[]));
  }, [isOpen, selectedWorkspace, firestore]);

  useEffect(() => {
    if (!isOpen || !isUserAdmin || !selectedWorkspace || !firestore) return;
    const users = Object.entries(selectedWorkspace.users || {});
    Promise.all(
      users.map(async ([uid]) => {
        try {
          const [tasksSnap, userSnap] = await Promise.all([
            getDocs(collection(firestore, `user-tasks/${uid}/tasks`)),
            getDoc(doc(firestore, 'users', uid)),
          ]);
          const allTasks = tasksSnap.docs.map(d => d.data() as UserTask)
            .filter(t => t.workspaceId === selectedWorkspace.id);
          const profile = userSnap.data();
          return {
            name: profile?.name || profile?.email || uid,
            uid,
            totalTasks: allTasks.filter(t => !t.completed).length,
            completedTasks: allTasks.filter(t => t.completed).length,
            overdueTasks: allTasks.filter(t => !t.completed && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))).length,
            userTasks: allTasks,
            tasks: allTasks.map(t => ({
              title: t.title,
              status: t.status || (t.completed ? 'completed' : 'todo'),
              priority: t.priority,
              dueDate: t.dueDate,
              completed: t.completed,
              companyName: t.companyName,
              projectName: t.projectName,
            })),
          };
        } catch { return null; }
      })
    ).then(r => setTeamMembers(r.filter(Boolean) as any[]));
  }, [isOpen, isUserAdmin, selectedWorkspace, firestore]);

  const [companyNames, setCompanyNames] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || !selectedWorkspace || !firestore) return;
    getDocs(collection(firestore, 'workspaces', selectedWorkspace.id, 'companies'))
      .then(async companiesSnap => {
        const names: string[] = [];
        const sales: Array<{ companyName: string; projectName: string; totalSalesValue: number; status: string; deadline?: string }> = [];
        await Promise.all(
          companiesSnap.docs.map(async companyDoc => {
            const companyName = companyDoc.data().name as string;
            names.push(companyName);
            try {
              const projectsSnap = await getDocs(collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyDoc.id, 'projects'));
              projectsSnap.docs.forEach(d => {
                const p = d.data();
                sales.push({ companyName, projectName: p.name, totalSalesValue: p.totalSalesValue || 0, status: p.status, deadline: p.deadline });
              });
            } catch { /* skip */ }
          })
        );
        setCompanyNames(names);
        setSalesSummary(sales);
      })
      .catch(() => {});
  }, [isOpen, selectedWorkspace, firestore]);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 150);
  }, [isOpen]);

  // load memory when popover opens
  useEffect(() => {
    if (!isOpen || !user || !selectedWorkspace) return;
    Promise.all([
      getWorkspaceMemory(firestore, selectedWorkspace.id),
      getUserMemory(firestore, selectedWorkspace.id, user.uid),
    ]).then(([wsMem, userMem]) => {
      setWorkspaceMemory(wsMem.facts);
      setUserPreferences(userMem.preferences);
      setUserPatterns(userMem.patterns);
    }).catch(() => {});
  }, [isOpen, user, selectedWorkspace, firestore]);

  const buildContext = () => ({
    userName: user?.displayName || user?.email || 'there',
    isAdmin: isUserAdmin,
    currentDate: format(new Date(), 'yyyy-MM-dd'),
    myTasks: (myTasks || [])
      .filter(t => !selectedWorkspace || t.workspaceId === selectedWorkspace.id)
      .map(t => ({
        title: t.title,
        status: t.status || (t.completed ? 'completed' : 'todo'),
        priority: t.priority,
        dueDate: t.dueDate,
        completed: t.completed,
        companyName: t.companyName,
        projectName: t.projectName,
      })),
    teamMembers: isUserAdmin ? teamMembers.map(m => ({
      name: m.name,
      totalTasks: m.totalTasks,
      completedTasks: m.completedTasks,
      overdueTasks: m.overdueTasks,
      tasks: m.tasks,
    })) : undefined,
    companyNames,
    salesSummary: isUserAdmin ? salesSummary : undefined,
    workspaceMembers: memberNames.length ? memberNames : undefined,
    workspaceMemory: workspaceMemory.length ? workspaceMemory : undefined,
    userPreferences: userPreferences.length ? userPreferences : undefined,
    userPatterns: userPatterns.length ? userPatterns : undefined,
  });

  const blockCtx = useMemo<BlockContext>(() => ({
    myTasks: (myTasks || []).filter(t => !selectedWorkspace || t.workspaceId === selectedWorkspace.id),
    teamMembers: isUserAdmin ? teamMembers : undefined,
    salesSummary: isUserAdmin ? salesSummary : undefined,
    isUserAdmin,
  }), [myTasks, selectedWorkspace, teamMembers, salesSummary, isUserAdmin]);

  const updateMemoryInBackground = useCallback(async (finalMessages: SaturnMessage[]) => {
    if (!user || !selectedWorkspace) return;
    try {
      const extracted = await extractMemoryFromConversation({
        conversation: finalMessages,
        existingWorkspaceFacts: workspaceMemory,
        existingUserPreferences: userPreferences,
        existingUserPatterns: userPatterns,
        userName: user.displayName || user.email || 'User',
        workspaceName: selectedWorkspace.name,
      });
      if (!extracted.workspaceFacts.length && !extracted.userPreferences.length && !extracted.userPatterns.length) return;
      const merged = mergeMemory(
        { workspaceFacts: workspaceMemory, userPreferences, userPatterns },
        extracted,
      );
      await Promise.all([
        saveWorkspaceMemory(firestore, selectedWorkspace.id, merged.workspaceFacts),
        saveUserMemory(firestore, selectedWorkspace.id, user.uid, merged.userPreferences, merged.userPatterns),
      ]);
      setWorkspaceMemory(merged.workspaceFacts);
      setUserPreferences(merged.userPreferences);
      setUserPatterns(merged.userPatterns);
    } catch { /* silent */ }
  }, [user, selectedWorkspace, firestore, workspaceMemory, userPreferences, userPatterns]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMessage: SaturnMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setPendingAction(null);
    try {
      const rawResponse = await saturnChat({ messages: updatedMessages, context: buildContext() });
      const { content, action } = parseSaturnResponse(rawResponse);
      const finalMessages = [...updatedMessages, { role: 'model' as const, content }];
      setMessages(finalMessages);
      if (action) setPendingAction(action);
      updateMemoryInBackground(finalMessages);
    } catch {
      setMessages(prev => [...prev, { role: 'model', content: "Something went wrong. Please try again." }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction || !user || !selectedWorkspace) return;
    setIsExecutingAction(true);
    try {
      const result = await executeSaturnAction(pendingAction, { firestore, user: user as any, selectedWorkspace });
      setPendingAction(null);
      setMessages(prev => [...prev, { role: 'model', content: `✅ Done! ${result}` }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', content: `❌ Couldn't complete that: ${e.message}` }]);
      setPendingAction(null);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const cancelAction = () => {
    setPendingAction(null);
    setMessages(prev => [...prev, { role: 'model', content: "No problem, cancelled. Anything else?" }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const openFullPage = () => {
    setIsOpen(false);
    router.push('/saturn');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center',
            'hover:bg-muted transition-colors relative',
            isOpen && 'bg-muted',
          )}
          aria-label="Open Saturn AI"
        >
          <Orbit
            className="h-4 w-4 text-primary"
            style={{ animation: 'spin 8s linear infinite' }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 rounded-2xl border border-border/60 shadow-2xl shadow-black/20 overflow-hidden"
      >
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-primary/5 shrink-0">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-primary shadow-sm shadow-primary/20">
            <Orbit className="h-4 w-4 text-white" style={{ animation: 'spin 8s linear infinite' }} />
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
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
                  <Orbit className="h-6 w-6 text-primary" style={{ animation: 'spin 8s linear infinite' }} />
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
                blockCtx={m.role === 'model' ? blockCtx : undefined}
              />
            ))}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-lg flex items-center justify-center bg-primary shrink-0">
                  <Orbit className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-muted/70 border border-border/40 rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {pendingAction && !isLoading && (
              <CompactActionCard
                action={pendingAction}
                onConfirm={confirmAction}
                onCancel={cancelAction}
                isLoading={isExecutingAction}
              />
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* input */}
        <div className="border-t border-border/50 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 focus-within:border-primary/40 transition-colors">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask something…"
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent p-0 text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 min-h-[20px] max-h-[80px]"
              disabled={isLoading || isExecutingAction}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading || isExecutingAction}
              className={cn(
                'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all',
                'bg-primary hover:bg-primary/90',
                'text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed',
              )}
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
