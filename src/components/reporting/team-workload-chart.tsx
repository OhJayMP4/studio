'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import type { UserTask } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface TeamMember {
    uid: string;
    name: string | null;
    email: string | null;
}

interface TeamWorkloadChartProps {
    workspaceId: string;
    members: TeamMember[];
}

type SortKey = 'urgency' | 'dueDate' | 'priority' | 'title';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLORS: Record<string, string> = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
};

const chartConfig = {
    tasks: { label: 'Active Tasks', color: 'hsl(var(--primary))' },
};

function displayName(m: TeamMember): string {
    if (m.name && !m.name.includes('@')) return m.name;
    if (m.email) return m.email.split('@')[0];
    return m.uid.slice(0, 8);
}

function TaskItem({ task }: { task: UserTask }) {
    const due = new Date(task.dueDate);
    const overdue = isPast(due) && !isToday(due) && !task.completed;
    const dueToday = isToday(due) && !task.completed;

    return (
        <div className="flex items-start gap-3 py-3 border-b last:border-0">
            <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', PRIORITY_COLORS[task.priority])} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{task.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {task.companyName}{task.projectId !== 'general-tasks' ? ` · ${task.projectName}` : ''}
                </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge
                    variant={task.priority === 'high' ? 'destructive' : 'secondary'}
                    className="text-[10px] uppercase"
                >
                    {task.priority}
                </Badge>
                <span className={cn(
                    'text-xs font-medium',
                    overdue && 'text-destructive',
                    dueToday && 'text-amber-600',
                    !overdue && !dueToday && 'text-muted-foreground'
                )}>
                    {overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}{format(due, 'MMM d')}
                </span>
            </div>
        </div>
    );
}

function MemberTaskSheet({
    member,
    workspaceId,
    open,
    onClose,
}: {
    member: TeamMember | null;
    workspaceId: string;
    open: boolean;
    onClose: () => void;
}) {
    const firestore = useFirestore();
    const [tasks, setTasks] = useState<UserTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('urgency');
    const [companyFilter, setCompanyFilter] = useState<string>('all');

    useEffect(() => {
        if (!open || !member || !firestore) return;
        setIsLoading(true);
        const tasksRef = collection(firestore, `user-tasks/${member.uid}/tasks`);
        const q = query(
            tasksRef,
            where('workspaceId', '==', workspaceId),
            where('completed', '==', false)
        );
        getDocs(q)
            .then(snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserTask))))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [open, member, firestore, workspaceId]);

    const companies = useMemo(() => {
        const seen = new Set<string>();
        const list: { id: string; name: string }[] = [];
        tasks.forEach(t => {
            if (!seen.has(t.companyId)) {
                seen.add(t.companyId);
                list.push({ id: t.companyId, name: t.companyName });
            }
        });
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [tasks]);

    const filtered = useMemo(() => {
        let result = companyFilter === 'all' ? tasks : tasks.filter(t => t.companyId === companyFilter);

        result = [...result].sort((a, b) => {
            if (sortKey === 'urgency') {
                // overdue first, then by priority, then by dueDate
                const aOver = isPast(new Date(a.dueDate)) && !isToday(new Date(a.dueDate));
                const bOver = isPast(new Date(b.dueDate)) && !isToday(new Date(b.dueDate));
                if (aOver !== bOver) return aOver ? -1 : 1;
                const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
                if (pDiff !== 0) return pDiff;
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            }
            if (sortKey === 'dueDate') return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            if (sortKey === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            if (sortKey === 'title') return a.title.localeCompare(b.title);
            return 0;
        });

        return result;
    }, [tasks, sortKey, companyFilter]);

    const overdue = tasks.filter(t => isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)));
    const dueToday = tasks.filter(t => isToday(new Date(t.dueDate)));

    return (
        <Sheet open={open} onOpenChange={v => !v && onClose()}>
            <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
                <SheetHeader className="p-6 pb-4 border-b">
                    <SheetTitle>{member ? displayName(member) : ''}'s Tasks</SheetTitle>
                    <SheetDescription>
                        Active tasks across the workspace
                    </SheetDescription>
                    {!isLoading && tasks.length > 0 && (
                        <div className="flex gap-3 mt-2 text-xs">
                            {overdue.length > 0 && (
                                <span className="flex items-center gap-1 text-destructive font-medium">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    {overdue.length} overdue
                                </span>
                            )}
                            {dueToday.length > 0 && (
                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                    <Clock className="h-3.5 w-3.5" />
                                    {dueToday.length} due today
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {tasks.length} total
                            </span>
                        </div>
                    )}
                </SheetHeader>

                {/* Controls */}
                <div className="flex gap-2 p-4 border-b">
                    <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="urgency">Sort: Urgency</SelectItem>
                            <SelectItem value="dueDate">Sort: Due Date</SelectItem>
                            <SelectItem value="priority">Sort: Priority</SelectItem>
                            <SelectItem value="title">Sort: Title</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue placeholder="All companies" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Companies</SelectItem>
                            {companies.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Task list */}
                <div className="flex-1 overflow-y-auto px-6">
                    {isLoading ? (
                        <div className="space-y-3 py-4">
                            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">
                            {companyFilter !== 'all' ? 'No tasks for this company.' : 'No active tasks.'}
                        </p>
                    ) : (
                        filtered.map(t => <TaskItem key={t.id} task={t} />)
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

export function TeamWorkloadChart({ workspaceId, members }: TeamWorkloadChartProps) {
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<{ uid: string; name: string; tasks: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const memberMap = useMemo(() => {
        const map: Record<string, TeamMember> = {};
        members.forEach(m => { map[m.uid] = m; });
        return map;
    }, [members]);

    // Dynamic YAxis width based on longest name
    const yAxisWidth = useMemo(() => {
        if (chartData.length === 0) return 80;
        const longest = Math.max(...chartData.map(d => d.name.length));
        return Math.min(Math.max(longest * 7.5, 60), 140);
    }, [chartData]);

    useEffect(() => {
        if (!workspaceId || !firestore || members.length === 0) {
            setIsLoading(false);
            return;
        }

        const fetchWorkload = async () => {
            setIsLoading(true);
            try {
                const counts: Record<string, number> = {};

                await Promise.all(
                    members.map(async (member) => {
                        const tasksRef = collection(firestore, `user-tasks/${member.uid}/tasks`);
                        const q = query(
                            tasksRef,
                            where('workspaceId', '==', workspaceId),
                            where('completed', '==', false)
                        );
                        const snap = await getDocs(q);
                        if (snap.size > 0) counts[member.uid] = snap.size;
                    })
                );

                const result = Object.entries(counts)
                    .map(([uid, tasks]) => ({
                        uid,
                        name: memberMap[uid] ? displayName(memberMap[uid]) : uid.slice(0, 8),
                        tasks,
                    }))
                    .sort((a, b) => b.tasks - a.tasks);

                setChartData(result);
            } catch (e) {
                console.error('Failed to fetch team workload:', e);
                setChartData([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWorkload();
    }, [workspaceId, firestore, members, memberMap]);

    const handleBarClick = (data: { uid: string; name: string; tasks: number }) => {
        const member = memberMap[data.uid];
        if (member) {
            setSelectedMember(member);
            setSheetOpen(true);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-52 mt-1" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Team Workload</CardTitle>
                    </div>
                    <CardDescription>Active tasks per team member — click a bar for details.</CardDescription>
                </CardHeader>
                <CardContent>
                    {chartData.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No active tasks found across the workspace.
                        </p>
                    ) : (
                        <ChartContainer
                            config={chartConfig}
                            className="w-full"
                            style={{ height: Math.max(chartData.length * 40, 120) }}
                        >
                            <BarChart
                                layout="vertical"
                                data={chartData}
                                margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
                                onClick={(e) => {
                                    if (e?.activePayload?.[0]?.payload) {
                                        handleBarClick(e.activePayload[0].payload);
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <CartesianGrid horizontal={false} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tickLine={false}
                                    axisLine={false}
                                    width={yAxisWidth}
                                    tick={{ fontSize: 12 }}
                                />
                                <XAxis
                                    type="number"
                                    allowDecimals={false}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11 }}
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="tasks" radius={4}>
                                    {chartData.map((entry) => (
                                        <Cell
                                            key={entry.uid}
                                            fill="var(--color-tasks)"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            <MemberTaskSheet
                member={selectedMember}
                workspaceId={workspaceId}
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
            />
        </>
    );
}
