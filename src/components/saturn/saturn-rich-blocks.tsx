'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, isPast, isToday } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { Building2, FolderOpen, BarChart3, ArrowRight, Loader2, CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskDetailsDialog } from '@/components/common/task-details-dialog';
import type { Task, UserTask } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { resolveNavigationPath } from '@/lib/saturn-actions';
import type { SaturnBlock, BlockContext, TeamMemberData, SalesSummaryItem } from '@/lib/saturn-blocks';
import { parseMessageParts } from '@/lib/saturn-blocks';

// ─── helpers ─────────────────────────────────────────────────────────────────

function userTaskToTask(ut: UserTask): Task {
  return {
    id: ut.originalTaskId,
    title: ut.title,
    description: ut.description,
    completed: ut.completed,
    status: ut.status,
    dueDate: ut.dueDate,
    priority: ut.priority,
    assigneeId: ut.assigneeId,
    projectId: ut.projectId,
    workspaceId: ut.workspaceId,
    createdBy: ut.createdBy,
    timeSpentMinutes: ut.timeSpentMinutes,
  };
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-muted-foreground/40',
};

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  todo: { label: 'To Do', cls: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  awaiting_approval: { label: 'Review', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  completed: { label: 'Done', cls: 'bg-green-500/10 text-green-600 dark:text-green-400' },
};

// ─── task card ────────────────────────────────────────────────────────────────

function TaskCard({ ut }: { ut: UserTask }) {
  const [open, setOpen] = useState(false);
  const task = useMemo(() => userTaskToTask(ut), [ut]);
  const path = `workspaces/${ut.workspaceId}/companies/${ut.companyId}/projects/${ut.projectId}/silos/${ut.siloId}/tasks/${ut.originalTaskId}`;

  const due = ut.dueDate ? new Date(ut.dueDate) : null;
  const overdue = !ut.completed && due && isPast(due) && !isToday(due);
  const dueToday = !ut.completed && due && isToday(due);
  const status = STATUS_CHIP[ut.status || (ut.completed ? 'completed' : 'todo')] ?? STATUS_CHIP.todo;

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-background hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer"
      >
        <div className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[ut.priority] ?? PRIORITY_DOT.low)} />

        <div className="flex-1 min-w-0">
          <p className={cn('text-[13px] font-medium leading-snug truncate', ut.completed && 'line-through text-muted-foreground')}>
            {ut.title}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {ut.companyName} / {ut.projectName}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {due && (
            <span className={cn(
              'text-[11px] font-medium',
              overdue ? 'text-red-500' : dueToday ? 'text-amber-500' : 'text-muted-foreground',
            )}>
              {overdue ? '⚠ ' : ''}{format(due, 'MMM d')}
            </span>
          )}
          <span className={cn('text-[11px] px-1.5 py-0.5 rounded-md font-medium', status.cls)}>
            {status.label}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
        </div>
      </div>

      {/* Only mount TaskDetailsDialog (and its Firestore listeners) when the card is opened */}
      {open && (
        <TaskDetailsDialog task={task} path={path} open={open} onOpenChange={setOpen}>
          <span className="sr-only">open</span>
        </TaskDetailsDialog>
      )}
    </>
  );
}

// ─── task list block ──────────────────────────────────────────────────────────

function TaskListBlock({ block, myTasks, teamMembers }: {
  block: Extract<SaturnBlock, { type: 'task_list' }>;
  myTasks: UserTask[];
  teamMembers?: TeamMemberData[];
}) {
  const today = useMemo(() => new Date(), []);

  const tasks = useMemo(() => {
    // Filter from a specific team member
    if (block.assignee && teamMembers) {
      const nameLower = block.assignee.toLowerCase();
      const member = teamMembers.find(m => m.name.toLowerCase().includes(nameLower));
      if (member?.userTasks) {
        return member.userTasks.filter(t => !t.completed);
      }
      return [];
    }

    // Filter by specific titles
    if (block.titles?.length) {
      const titlesLower = block.titles.map(t => t.toLowerCase());
      return myTasks.filter(t =>
        titlesLower.some(title => t.title.toLowerCase().includes(title))
      );
    }

    // Preset filters
    switch (block.filter) {
      case 'overdue':
        return myTasks.filter(t => !t.completed && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)));
      case 'today':
        return myTasks.filter(t => !t.completed && t.dueDate && isToday(new Date(t.dueDate)));
      case 'all':
      case 'mine':
      default:
        return myTasks.filter(t => !t.completed);
    }
  }, [block, myTasks, teamMembers, today]);

  const sorted = useMemo(() => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...tasks].sort((a, b) => {
      const aOver = a.dueDate && isPast(new Date(a.dueDate)) && !isToday(new Date(a.dueDate)) ? 0 : 1;
      const bOver = b.dueDate && isPast(new Date(b.dueDate)) && !isToday(new Date(b.dueDate)) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });
  }, [tasks]);

  const capped = sorted.slice(0, 15);

  if (!capped.length) {
    const emptyMessages: Record<string, string> = {
      overdue: '✅ No overdue tasks — you\'re all caught up!',
      today: '📅 Nothing due today.',
      all: '✅ No open tasks right now.',
      mine: '✅ No open tasks right now.',
    };
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/40 bg-muted/30 text-[13px] text-muted-foreground">
        {emptyMessages[block.filter ?? 'all'] ?? 'No tasks found.'}
      </div>
    );
  }

  const label = block.assignee
    ? `${block.assignee}'s tasks`
    : block.filter === 'overdue' ? 'Overdue tasks'
    : block.filter === 'today' ? 'Due today'
    : `Open tasks`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{sorted.length}</span>
      </div>
      <div className="space-y-1">
        {capped.map((ut, i) => <TaskCard key={ut.id ?? i} ut={ut} />)}
        {sorted.length > 15 && (
          <p className="text-[11px] text-muted-foreground text-center py-1">
            +{sorted.length - 15} more — ask me to filter by company or priority
          </p>
        )}
      </div>
    </div>
  );
}

// ─── report blocks ────────────────────────────────────────────────────────────

function WorkloadReport({ teamMembers }: { teamMembers?: TeamMemberData[] }) {
  if (!teamMembers?.length) {
    return <div className="text-[13px] text-muted-foreground px-3 py-2.5 rounded-xl border border-border/40 bg-muted/30">No team data available.</div>;
  }
  const sorted = [...teamMembers].sort((a, b) => b.overdueTasks - a.overdueTasks || b.totalTasks - a.totalTasks);

  return (
    <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
      <div className="px-3 py-2 border-b border-border/40 bg-muted/30 flex items-center gap-2">
        <BarChart3 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12px] font-semibold text-foreground uppercase tracking-wide">Team Workload</span>
      </div>
      <div className="divide-y divide-border/40">
        <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 px-3 py-2">
          {['Member', 'Open', 'Overdue', 'Done'].map(h => (
            <span key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</span>
          ))}
        </div>
        {sorted.map((m, i) => {
          const total = m.totalTasks + m.completedTasks || 1;
          const pct = Math.round((m.completedTasks / total) * 100);
          return (
            <div key={i} className="grid grid-cols-[1fr_60px_60px_60px] gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors">
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{m.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                </div>
              </div>
              <span className="text-[13px] font-medium self-center">{m.totalTasks}</span>
              <span className={cn('text-[13px] font-medium self-center', m.overdueTasks > 0 && 'text-red-500')}>
                {m.overdueTasks > 0 ? `⚠ ${m.overdueTasks}` : '—'}
              </span>
              <span className="text-[13px] text-muted-foreground self-center">{m.completedTasks}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SalesReport({ salesSummary }: { salesSummary?: SalesSummaryItem[] }) {
  if (!salesSummary?.length) {
    return <div className="text-[13px] text-muted-foreground px-3 py-2.5 rounded-xl border border-border/40 bg-muted/30">No sales data available.</div>;
  }
  const sorted = [...salesSummary].sort((a, b) => b.totalSalesValue - a.totalSalesValue);
  const total = sorted.reduce((sum, s) => sum + s.totalSalesValue, 0);

  const STATUS_COLORS: Record<string, string> = {
    active: 'text-green-600 dark:text-green-400',
    completed: 'text-muted-foreground',
    archived: 'text-muted-foreground/50',
  };

  return (
    <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
      <div className="px-3 py-2 border-b border-border/40 bg-muted/30 flex items-center gap-2">
        <BarChart3 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12px] font-semibold text-foreground uppercase tracking-wide">Sales by Project</span>
      </div>
      <div className="divide-y divide-border/40">
        <div className="grid grid-cols-[1fr_1fr_70px_80px] gap-2 px-3 py-2">
          {['Company', 'Project', 'Status', 'Value'].map(h => (
            <span key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</span>
          ))}
        </div>
        {sorted.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_70px_80px] gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
            <span className="text-[12px] truncate">{s.companyName}</span>
            <span className="text-[12px] text-muted-foreground truncate">{s.projectName}</span>
            <span className={cn('text-[12px] font-medium capitalize', STATUS_COLORS[s.status] ?? '')}>{s.status}</span>
            <span className="text-[12px] font-semibold text-foreground">R{s.totalSalesValue.toLocaleString()}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
          <span className="text-[12px] font-semibold text-foreground">Total</span>
          <span className="text-[13px] font-bold text-primary">R{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function OverdueReport({ myTasks, teamMembers, isUserAdmin }: {
  myTasks: UserTask[];
  teamMembers?: TeamMemberData[];
  isUserAdmin: boolean;
}) {
  const today = new Date();
  const overdueTasks = myTasks.filter(t => !t.completed && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)));

  const allOverdue = useMemo(() => {
    if (!isUserAdmin || !teamMembers) return overdueTasks;
    const teamOverdue: UserTask[] = [];
    teamMembers.forEach(m => {
      (m.userTasks || []).forEach(t => {
        if (!t.completed && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))) {
          teamOverdue.push(t);
        }
      });
    });
    return teamOverdue;
  }, [isUserAdmin, teamMembers, overdueTasks]);

  if (!allOverdue.length) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-500/30 bg-green-500/5 text-[13px] text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        No overdue tasks across the {isUserAdmin ? 'team' : 'board'}.
      </div>
    );
  }

  const sorted = [...allOverdue].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="rounded-xl border border-red-500/20 bg-background overflow-hidden">
      <div className="px-3 py-2 border-b border-red-500/20 bg-red-500/5 flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        <span className="text-[12px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Overdue — {sorted.length} task{sorted.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="p-1.5 space-y-1">
        {sorted.map((ut, i) => <TaskCard key={ut.id ?? i} ut={ut} />)}
      </div>
    </div>
  );
}

// ─── navigate block ───────────────────────────────────────────────────────────

function NavigateBlock({ block }: { block: Extract<SaturnBlock, { type: 'navigate' }> }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const firestore = useFirestore();
  const { selectedWorkspace } = useSelectedWorkspace();

  const handleClick = async () => {
    if (block.to === 'reporting') {
      router.push('/reporting');
      return;
    }
    if (block.to === 'tasks') {
      router.push('/tasks');
      return;
    }
    if (!selectedWorkspace || !block.company) return;
    setLoading(true);
    try {
      const path = await resolveNavigationPath(
        firestore,
        selectedWorkspace.id,
        block.company,
        block.to === 'project' ? block.project : undefined,
      );
      if (path) router.push(path);
    } finally {
      setLoading(false);
    }
  };

  const icon = block.to === 'project' ? FolderOpen : block.to === 'reporting' ? BarChart3 : Building2;
  const Icon = icon;
  const label = block.to === 'project'
    ? block.project ?? block.company ?? 'Open Project'
    : block.to === 'reporting'
    ? 'Reporting Dashboard'
    : block.company ?? 'Open Company';
  const sublabel = block.to === 'project' && block.company
    ? block.company
    : block.to === 'project'
    ? 'View project page'
    : block.to === 'reporting'
    ? 'View reports & analytics'
    : 'View company page';

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-background hover:bg-muted/40 hover:border-primary/30 transition-all text-left disabled:opacity-60"
    >
      <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
        {loading ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> : <Icon className="h-4 w-4 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sublabel}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
    </button>
  );
}

// ─── report block dispatcher ──────────────────────────────────────────────────

function ReportBlockRenderer({ block, ctx }: {
  block: Extract<SaturnBlock, { type: 'report' }>;
  ctx: BlockContext;
}) {
  switch (block.kind) {
    case 'workload': return <WorkloadReport teamMembers={ctx.teamMembers} />;
    case 'sales': return <SalesReport salesSummary={ctx.salesSummary} />;
    case 'overdue': return <OverdueReport myTasks={ctx.myTasks} teamMembers={ctx.teamMembers} isUserAdmin={ctx.isUserAdmin} />;
    default: return null;
  }
}

// ─── block dispatcher ─────────────────────────────────────────────────────────

function BlockRenderer({ block, ctx }: { block: SaturnBlock; ctx: BlockContext }) {
  switch (block.type) {
    case 'task_list':
      return <TaskListBlock block={block} myTasks={ctx.myTasks} teamMembers={ctx.teamMembers} />;
    case 'report':
      return <ReportBlockRenderer block={block} ctx={ctx} />;
    case 'navigate':
      return <NavigateBlock block={block} />;
    default:
      return null;
  }
}

// ─── main export: message content renderer ────────────────────────────────────

export function SaturnMessageContent({ content, ctx }: {
  content: string;
  ctx: BlockContext;
}) {
  const parts = useMemo(() => parseMessageParts(content), [content]);

  return (
    <div className="space-y-3">
      {parts.map((part, i) =>
        part.kind === 'text' ? (
          part.content.trim() ? (
            <div key={i} className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:font-semibold">
              <ReactMarkdown>{part.content}</ReactMarkdown>
            </div>
          ) : null
        ) : (
          <BlockRenderer key={i} block={part.block} ctx={ctx} />
        )
      )}
    </div>
  );
}
