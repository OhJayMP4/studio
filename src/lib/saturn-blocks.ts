import type { UserTask } from './types';

export type TaskListBlock = {
  type: 'task_list';
  filter?: 'overdue' | 'today' | 'all' | 'mine';
  titles?: string[];
  assignee?: string;
};

export type ReportBlock = {
  type: 'report';
  kind: 'workload' | 'sales' | 'overdue';
};

export type NavigateBlock = {
  type: 'navigate';
  to: 'project' | 'company' | 'reporting' | 'tasks';
  company?: string;
  project?: string;
};

export type SaturnBlock = TaskListBlock | ReportBlock | NavigateBlock;

export type MessagePart =
  | { kind: 'text'; content: string }
  | { kind: 'block'; block: SaturnBlock };

export function parseMessageParts(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const regex = /__SATURN_BLOCK__(\{[^\n]+\})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index).trim();
    if (textBefore) parts.push({ kind: 'text', content: textBefore });
    try {
      parts.push({ kind: 'block', block: JSON.parse(match[1]) as SaturnBlock });
    } catch {
      parts.push({ kind: 'text', content: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex).trim();
  if (remaining) parts.push({ kind: 'text', content: remaining });

  return parts.filter(p => p.kind === 'block' || (p.kind === 'text' && p.content.trim().length > 0));
}

// Shared team member type used across Saturn components
export type TeamMemberData = {
  name: string;
  uid?: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  userTasks?: UserTask[];
  tasks: Array<{
    title: string; status: string; priority: string;
    dueDate?: string; completed: boolean;
    companyName?: string; projectName?: string;
  }>;
};

export type SalesSummaryItem = {
  companyName: string;
  projectName: string;
  totalSalesValue: number;
  status: string;
  deadline?: string;
};

export type BlockContext = {
  myTasks: UserTask[];
  teamMembers?: TeamMemberData[];
  salesSummary?: SalesSummaryItem[];
  isUserAdmin: boolean;
};
