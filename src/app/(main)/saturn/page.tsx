'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { collection, query, orderBy, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { UserTask, SaturnChat } from '@/lib/types';
import { saturnChat, type SaturnMessage } from '@/ai/flows/saturn-chat-flow';
import { parseSaturnResponse, executeSaturnAction, ACTION_LABELS, ACTION_ICONS, ACTION_FIELD_LABELS, type SaturnAction } from '@/lib/saturn-actions';
import { getWorkspaceMemory, getUserMemory, saveWorkspaceMemory, saveUserMemory, mergeMemory } from '@/lib/saturn-memory';
import { extractMemoryFromConversation } from '@/ai/flows/saturn-memory-flow';
import { SaturnMessageContent } from '@/components/saturn/saturn-rich-blocks';
import type { BlockContext, TeamMemberData } from '@/lib/saturn-blocks';
import { cn } from '@/lib/utils';
import { Orbit, Send, Loader2, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import { format, isPast, isToday } from 'date-fns';

// ─── suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { label: 'What needs my attention today?', icon: '🎯' },
  { label: "What's my week looking like?", icon: '📅' },
  { label: 'Do I have any overdue tasks?', icon: '⚠️' },
  { label: 'Give me a full summary of where I stand', icon: '📊' },
];

const ADMIN_PROMPTS = [
  { label: 'How is the team doing?', icon: '👥' },
  { label: 'Who has the most on their plate right now?', icon: '⚖️' },
  { label: "What's at risk this week across the team?", icon: '🚨' },
  { label: 'How are sales looking across the portfolio?', icon: '💰' },
];

// ─── Saturn logo ──────────────────────────────────────────────────────────────

function SaturnLogo({ size = 'md', spin = false }: { size?: 'sm' | 'md' | 'lg'; spin?: boolean }) {
  const sizes = { sm: 'h-8 w-8', md: 'h-14 w-14', lg: 'h-20 w-20' };
  const iconSizes = { sm: 'h-4 w-4', md: 'h-7 w-7', lg: 'h-10 w-10' };
  return (
    <div className={cn(sizes[size], 'rounded-2xl flex items-center justify-center shrink-0 bg-primary shadow-lg shadow-primary/30')}>
      <Orbit className={cn(iconSizes[size], 'text-white')} style={spin ? { animation: 'spin 8s linear infinite' } : undefined} />
    </div>
  );
}

// ─── message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, userName, userAvatar, blockCtx }: {
  message: SaturnMessage;
  userName: string;
  userAvatar?: string | null;
  blockCtx?: BlockContext;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          <AvatarImage src={userAvatar ?? undefined} />
          <AvatarFallback className="text-[11px] font-bold bg-primary text-primary-foreground">
            {userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <SaturnLogo size="sm" />
      )}
      <div className={cn(
        'rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'max-w-[75%] bg-primary text-primary-foreground rounded-tr-sm'
          : 'flex-1 min-w-0 bg-muted/60 border border-border/50 rounded-tl-sm',
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : blockCtx ? (
          <SaturnMessageContent content={message.content} ctx={blockCtx} />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:font-semibold">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <SaturnLogo size="sm" />
      <div className="bg-muted/60 border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

// ─── action confirm card ──────────────────────────────────────────────────────

function ActionConfirmCard({ action, onConfirm, onCancel, isLoading }: {
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
    <div className="flex items-start gap-3">
      <SaturnLogo size="sm" />
      <div className="flex-1 rounded-2xl rounded-tl-sm border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <span className="ml-auto text-[11px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
            Awaiting confirmation
          </span>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/60 divide-y divide-border/40">
          {fields.map(f => (
            <div key={f.label} className="flex items-center gap-3 px-3 py-2 text-[13px]">
              <span className="text-muted-foreground w-20 shrink-0">{f.label}</span>
              <span className="text-foreground font-medium">{f.value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 h-9 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" /> {label}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SaturnPage() {
  const [messages, setMessages] = useState<SaturnMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SaturnAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [workspaceMemory, setWorkspaceMemory] = useState<string[]>([]);
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const [userPatterns, setUserPatterns] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useUser();
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const firestore = useFirestore();

  // ── chat history ──────────────────────────────────────────────────────────
  const chatsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, `users/${user.uid}/saturn-chats`), orderBy('updatedAt', 'desc'));
  }, [firestore, user]);
  const { data: chatHistory } = useCollection<SaturnChat>(chatsQuery);

  // ── user tasks ────────────────────────────────────────────────────────────
  const tasksQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, `user-tasks/${user.uid}/tasks`), orderBy('dueDate', 'asc'));
  }, [firestore, user]);
  const { data: myTasks } = useCollection<UserTask>(tasksQuery);

  // ── workspace member names (for task assignment) ──────────────────────────
  const [memberNames, setMemberNames] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedWorkspace || !firestore) return;
    Promise.all(
      Object.keys(selectedWorkspace.users || {}).map(async uid => {
        try {
          const snap = await getDoc(doc(firestore, 'users', uid));
          return (snap.data()?.name as string | undefined) || null;
        } catch { return null; }
      })
    ).then(names => setMemberNames(names.filter(Boolean) as string[]));
  }, [selectedWorkspace, firestore]);

  // ── admin: team names + sales ─────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [salesSummary, setSalesSummary] = useState<Array<{ companyName: string; projectName: string; totalSalesValue: number; status: string; deadline?: string }>>([]);
  const [companyNames, setCompanyNames] = useState<string[]>([]);

  useEffect(() => {
    if (!isUserAdmin || !selectedWorkspace || !firestore) return;
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
  }, [isUserAdmin, selectedWorkspace, firestore]);

  useEffect(() => {
    if (!selectedWorkspace || !firestore) return;
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
  }, [selectedWorkspace, firestore]);

  // ── load memory ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !selectedWorkspace) return;
    Promise.all([
      getWorkspaceMemory(firestore, selectedWorkspace.id),
      getUserMemory(firestore, selectedWorkspace.id, user.uid),
    ]).then(([wsMem, userMem]) => {
      setWorkspaceMemory(wsMem.facts);
      setUserPreferences(userMem.preferences);
      setUserPatterns(userMem.patterns);
    }).catch(() => {});
  }, [user, selectedWorkspace, firestore]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, pendingAction]);

  // ── chat persistence ──────────────────────────────────────────────────────

  const saveChat = useCallback(async (msgs: SaturnMessage[], chatId: string | null): Promise<string> => {
    if (!user) return chatId ?? '';
    const title = msgs.find(m => m.role === 'user')?.content.slice(0, 60) || 'New chat';
    const chatsRef = collection(firestore, `users/${user.uid}/saturn-chats`);
    if (!chatId) {
      const newDoc = await addDoc(chatsRef, { title, messages: msgs, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return newDoc.id;
    }
    await updateDoc(doc(chatsRef, chatId), { messages: msgs, updatedAt: serverTimestamp() });
    return chatId;
  }, [user, firestore]);

  const loadChat = (chat: SaturnChat) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setPendingAction(null);
    setInput('');
  };

  const newChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setPendingAction(null);
    setInput('');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return;
    try {
      await deleteDoc(doc(firestore, `users/${user.uid}/saturn-chats`, chatId));
      if (currentChatId === chatId) newChat();
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  // ── context builder ───────────────────────────────────────────────────────

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

  // ── background memory update ──────────────────────────────────────────────

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
    } catch { /* silent — memory is best-effort */ }
  }, [user, selectedWorkspace, firestore, workspaceMemory, userPreferences, userPatterns]);

  // ── send message ──────────────────────────────────────────────────────────

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
      const savedId = await saveChat(finalMessages, currentChatId);
      if (!currentChatId) setCurrentChatId(savedId);
      // fire-and-forget memory extraction
      updateMemoryInBackground(finalMessages);
    } catch {
      setMessages(prev => [...prev, { role: 'model', content: "I'm having trouble connecting right now. Please try again in a moment." }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  // ── action execution ──────────────────────────────────────────────────────

  const confirmAction = async () => {
    if (!pendingAction || !user || !selectedWorkspace) return;
    setIsExecutingAction(true);
    try {
      const result = await executeSaturnAction(pendingAction, { firestore, user: user as any, selectedWorkspace });
      setPendingAction(null);
      const confirmMsg: SaturnMessage = { role: 'model', content: `✅ Done! ${result}` };
      const newMessages = [...messages, confirmMsg];
      setMessages(newMessages);
      await saveChat(newMessages, currentChatId);
    } catch (e: any) {
      const errMsg: SaturnMessage = { role: 'model', content: `❌ Couldn't complete that: ${e.message}` };
      setMessages(prev => [...prev, errMsg]);
      setPendingAction(null);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const cancelAction = () => {
    setPendingAction(null);
    const cancelMsg: SaturnMessage = { role: 'model', content: "No problem, I've cancelled that. Is there anything else you'd like to do?" };
    setMessages(prev => [...prev, cancelMsg]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const firstName = (user?.displayName || '').split(' ')[0] || 'there';
  const prompts = isUserAdmin ? ADMIN_PROMPTS : SUGGESTED_PROMPTS;

  const blockCtx = useMemo<BlockContext>(() => ({
    myTasks: (myTasks || []).filter(t => !selectedWorkspace || t.workspaceId === selectedWorkspace.id),
    teamMembers: isUserAdmin ? teamMembers : undefined,
    salesSummary: isUserAdmin ? salesSummary : undefined,
    isUserAdmin,
  }), [myTasks, selectedWorkspace, teamMembers, salesSummary, isUserAdmin]);

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 lg:-m-6 overflow-hidden">

      {/* ── chat history sidebar ── */}
      <div className="w-56 shrink-0 border-r bg-muted/20 flex flex-col overflow-hidden">
        <div className="px-2.5 py-2.5 border-b">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-dashed border-border/50 hover:border-primary/30"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            New chat
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 py-2 space-y-0.5">
            {!chatHistory?.length && (
              <p className="text-[11px] text-muted-foreground/40 text-center py-8 px-3 leading-relaxed">
                Conversations will appear here
              </p>
            )}
            {chatHistory?.map(chat => (
              <div
                key={chat.id}
                onClick={() => loadChat(chat)}
                style={{ display: 'grid', gridTemplateColumns: '1fr 28px', alignItems: 'center', gap: '4px' }}
                className={cn(
                  'px-2.5 py-2 rounded-lg cursor-pointer transition-colors',
                  currentChatId === chat.id
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span className="text-[13px] truncate leading-none block">{chat.title}</span>
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  title="Delete"
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* empty state */}
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-10">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <SaturnLogo size="lg" spin />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-primary">
                  Saturn
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Your workspace intelligence — ask me anything</p>
              </div>
            </div>

            <div className="max-w-md text-center space-y-1">
              <p className="text-base font-medium text-foreground">Hey {firstName} 👋</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                I know your tasks, your team, and your portfolio. Ask me what needs your attention, how the team is tracking, or anything about your workspace. I can also create tasks, projects, silos, and companies for you.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {prompts.map(p => (
                <button
                  key={p.label}
                  onClick={() => sendMessage(p.label)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border border-border/60 text-left text-sm',
                    'bg-muted/30 hover:bg-muted/60 hover:border-primary/40',
                    'transition-all duration-150 group',
                  )}
                >
                  <span className="text-lg leading-none">{p.icon}</span>
                  <span className="text-foreground/80 group-hover:text-foreground transition-colors leading-snug">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* messages */}
        {messages.length > 0 && (
          <ScrollArea className="flex-1 px-4 lg:px-6">
            <div className="max-w-3xl mx-auto py-6 space-y-6">
              {messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  userName={user?.displayName || 'You'}
                  userAvatar={user?.photoURL}
                  blockCtx={m.role === 'model' ? blockCtx : undefined}
                />
              ))}
              {isLoading && <TypingIndicator />}
              {pendingAction && !isLoading && (
                <ActionConfirmCard
                  action={pendingAction}
                  onConfirm={confirmAction}
                  onCancel={cancelAction}
                  isLoading={isExecutingAction}
                />
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}

        {/* input bar */}
        <div className="shrink-0 border-t bg-background/80 backdrop-blur-sm px-4 lg:px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className={cn(
              'flex items-end gap-3 rounded-2xl border px-4 py-3 transition-all duration-200',
              'bg-background focus-within:border-primary/50 focus-within:shadow-sm focus-within:shadow-primary/10',
            )}>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Saturn anything, or say 'create a task for…'"
                rows={1}
                className="flex-1 resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-muted-foreground/50 min-h-[24px] max-h-[120px]"
                disabled={isLoading || isExecutingAction}
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading || isExecutingAction}
                className={cn(
                  'h-8 w-8 shrink-0 rounded-xl transition-all',
                  'bg-primary hover:bg-primary/90',
                  'disabled:opacity-30 disabled:cursor-not-allowed border-0 shadow-none',
                )}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/40 text-center mt-2">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
