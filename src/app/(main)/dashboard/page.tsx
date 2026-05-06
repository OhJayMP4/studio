'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Project, UserTask } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Folder, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { format, isPast, isToday, isTomorrow, addDays, isBefore, formatDistanceToNow, differenceInDays } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUserTasks } from "@/hooks/use-user-tasks";
import { TeamWorkloadChart } from "@/components/reporting/team-workload-chart";
import { ProjectDeadlinesChart } from "@/components/reporting/project-deadlines-chart";

type DashboardDetailView = 'main' | 'active-projects' | 'completed-projects' | 'active-tasks' | 'overdue-tasks' | 'awaiting-tasks';

const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-blue-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
};

function TaskRow({ task, variant }: { task: UserTask; variant: 'overdue' | 'awaiting' | 'upcoming' }) {
    const dueDate = new Date(task.dueDate);
    const isQuickTask = task.projectId === 'general-tasks';
    return (
        <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
            <div className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_COLORS[task.priority])} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-snug">{task.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                    {task.companyName}{!isQuickTask ? ` · ${task.projectName}` : ''}
                </p>
            </div>
            {variant === 'overdue' && (
                <span className="text-xs text-destructive font-semibold shrink-0 whitespace-nowrap">
                    {formatDistanceToNow(dueDate)} late
                </span>
            )}
            {variant === 'awaiting' && (
                <span className="text-xs text-amber-600 font-medium shrink-0 whitespace-nowrap">
                    Due {format(dueDate, 'MMM d')}
                </span>
            )}
            {variant === 'upcoming' && (
                <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {format(dueDate, 'MMM d')}
                </span>
            )}
        </div>
    );
}

function StatCell({
    value,
    label,
    onClick,
    color,
    loading,
    last,
}: {
    value: number;
    label: string;
    onClick: () => void;
    color?: 'destructive' | 'amber';
    loading: boolean;
    last?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col p-5 text-left hover:bg-muted/50 transition-colors",
                !last && "border-b lg:border-b-0 lg:border-r"
            )}
        >
            {loading ? (
                <Skeleton className="h-8 w-12 mb-1" />
            ) : (
                <span className={cn(
                    "text-3xl font-bold tabular-nums leading-none",
                    color === 'destructive' && value > 0 && "text-destructive",
                    color === 'amber' && value > 0 && "text-amber-600"
                )}>
                    {value}
                </span>
            )}
            <span className="text-[11px] text-muted-foreground mt-1.5 uppercase tracking-wider font-medium">
                {label}
            </span>
        </button>
    );
}

function DetailHeader({ title, onBack }: { title: string; onBack: () => void }) {
    return (
        <div className="flex items-center gap-4 mb-6">
            <Button variant="outline" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-headline font-bold">{title}</h2>
        </div>
    );
}

function DashboardView() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    const [detailView, setDetailView] = useState<DashboardDetailView>('main');
    const [allWorkspaceProjects, setAllWorkspaceProjects] = useState<Project[]>([]);
    const [isProjectsLoading, setIsProjectsLoading] = useState(false);

    const { tasks: rawUserTaskGroups, isLoading: isTasksLoading } = useUserTasks(selectedWorkspace?.id);
    const userTaskGroups = rawUserTaskGroups ?? { active: [], inProgress: [], awaitingApproval: [], completed: [] };

    useEffect(() => {
        if (!selectedWorkspace?.id || !firestore) return;

        const fetchProjects = async () => {
            setIsProjectsLoading(true);
            try {
                const companiesRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
                const companiesSnap = await getDocs(companiesRef);
                const projectPromises = companiesSnap.docs.map(async (companyDoc) => {
                    const projectsRef = collection(companyDoc.ref, 'projects');
                    const projectsSnap = await getDocs(projectsRef);
                    return projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
                });
                const results = await Promise.all(projectPromises);
                setAllWorkspaceProjects(results.flat());
            } catch (error) {
                console.error("Error fetching projects for dashboard:", error);
            } finally {
                setIsProjectsLoading(false);
            }
        };

        fetchProjects();
    }, [selectedWorkspace?.id, firestore]);

    const workspaceMembers = useMemo(() => {
        return Object.entries(selectedWorkspace?.users || {}).map(([uid, u]) => ({
            uid,
            name: u.name,
            email: u.email,
        }));
    }, [selectedWorkspace?.users]);

    const stats = useMemo(() => {
        const activeProjectsList = allWorkspaceProjects.filter(p =>
            p.id !== 'general-tasks' &&
            (p.status === 'active' || !p.status) &&
            p.status !== 'archived'
        );
        const completedProjectsList = allWorkspaceProjects.filter(p =>
            p.id !== 'general-tasks' &&
            (p.status === 'completed' || p.progress === 100) &&
            p.status !== 'archived'
        );

        const getStatus = (t: UserTask) => t.status || (t.completed ? 'completed' : 'todo');

        const activeTasks = userTaskGroups.active ?? [];
        const overdueTasksList = activeTasks.filter(t =>
            getStatus(t) !== 'awaiting_approval' &&
            isPast(new Date(t.dueDate)) &&
            !isToday(new Date(t.dueDate))
        );

        // Upcoming: not overdue, not awaiting approval, sorted by due date
        const now = new Date();
        const upcomingList = activeTasks.filter(t => {
            const d = new Date(t.dueDate);
            return getStatus(t) !== 'awaiting_approval' && (isToday(d) || !isPast(d));
        });

        const todayTasks = upcomingList.filter(t => isToday(new Date(t.dueDate)));
        const tomorrowTasks = upcomingList.filter(t => isTomorrow(new Date(t.dueDate)));
        const thisWeekTasks = upcomingList.filter(t => {
            const d = new Date(t.dueDate);
            return !isToday(d) && !isTomorrow(d) && isBefore(d, addDays(now, 7));
        });
        const laterTasks = upcomingList.filter(t => {
            const d = new Date(t.dueDate);
            return !isToday(d) && !isTomorrow(d) && !isBefore(d, addDays(now, 7));
        });

        const upcomingGrouped = [
            ...(todayTasks.length ? [{ label: 'Today', tasks: todayTasks }] : []),
            ...(tomorrowTasks.length ? [{ label: 'Tomorrow', tasks: tomorrowTasks }] : []),
            ...(thisWeekTasks.length ? [{ label: 'This Week', tasks: thisWeekTasks.slice(0, 5) }] : []),
            ...(laterTasks.length ? [{ label: 'Later', tasks: laterTasks.slice(0, 3) }] : []),
        ];

        return {
            activeProjects: activeProjectsList,
            completedProjects: completedProjectsList,
            overdueTasks: overdueTasksList,
            awaitingApprovalTasks: userTaskGroups.awaitingApproval ?? [],
            activeTasksCount: activeTasks.length,
            upcomingGrouped,
        };
    }, [allWorkspaceProjects, userTaskGroups]);

    const isLoading = isTasksLoading || isProjectsLoading;

    // ── Detail Views ──────────────────────────────────────────────────────────

    if (detailView === 'active-projects') {
        return (
            <div className="space-y-6">
                <DetailHeader title="Active Projects" onBack={() => setDetailView('main')} />
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project</TableHead>
                                    <TableHead>Deadline</TableHead>
                                    <TableHead className="text-right">Progress</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.activeProjects.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">
                                            <Link href={`/company/${p.companyId}/project/${p.id}`} className="flex items-center gap-2 hover:underline">
                                                <Folder className="h-4 w-4 text-primary" />
                                                {p.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {p.deadline ? format(new Date(p.deadline), 'MMM d, yyyy') : '–'}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{p.progress}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (detailView === 'completed-projects') {
        return (
            <div className="space-y-6">
                <DetailHeader title="Completed Projects" onBack={() => setDetailView('main')} />
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project</TableHead>
                                    <TableHead>Completed</TableHead>
                                    <TableHead className="text-right">Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.completedProjects.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">
                                            <Link href={`/company/${p.companyId}/project/${p.id}`} className="flex items-center gap-2 hover:underline">
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                {p.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {p.completedAt ? format(p.completedAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {p.hasMonetaryValue ? `R${p.monetaryValue?.toLocaleString()}` : '–'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (detailView === 'active-tasks') {
        return (
            <div className="space-y-6">
                <DetailHeader title="My Active Tasks" onBack={() => setDetailView('main')} />
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Company / Project</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead className="text-right">Priority</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userTaskGroups.active.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium">{t.title}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {t.companyName} / {t.projectName}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(new Date(t.dueDate), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={t.priority === 'high' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                                                {t.priority}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (detailView === 'overdue-tasks') {
        return (
            <div className="space-y-6">
                <DetailHeader title="My Overdue Tasks" onBack={() => setDetailView('main')} />
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.overdueTasks.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium text-destructive">{t.title}</TableCell>
                                        <TableCell className="text-muted-foreground">{t.companyName}</TableCell>
                                        <TableCell className="font-semibold text-destructive">
                                            {format(new Date(t.dueDate), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="destructive" className="uppercase text-[10px]">{t.priority}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href="/my-tasks">Go to Task</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (detailView === 'awaiting-tasks') {
        return (
            <div className="space-y-6">
                <DetailHeader title="Awaiting Approval" onBack={() => setDetailView('main')} />
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Original Due Date</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.awaitingApprovalTasks.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-amber-500" />
                                                {t.title}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{t.companyName}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(new Date(t.dueDate), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={t.priority === 'high' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                                                {t.priority}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href="/my-tasks">Follow Up</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {stats.awaitingApprovalTasks.length === 0 && (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                                No tasks awaiting approval.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── Main View ─────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-headline font-bold">Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(), "EEEE, MMMM d")} · {selectedWorkspace?.name}
                </p>
            </div>

            {/* Metrics Strip */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden grid grid-cols-2 lg:grid-cols-5">
                <StatCell
                    value={stats.activeProjects.length}
                    label="Active Projects"
                    onClick={() => setDetailView('active-projects')}
                    loading={isLoading}
                />
                <StatCell
                    value={stats.completedProjects.length}
                    label="Completed"
                    onClick={() => setDetailView('completed-projects')}
                    loading={isLoading}
                />
                <StatCell
                    value={stats.activeTasksCount}
                    label="My Tasks"
                    onClick={() => setDetailView('active-tasks')}
                    loading={isLoading}
                />
                <StatCell
                    value={stats.overdueTasks.length}
                    label="Overdue"
                    onClick={() => setDetailView('overdue-tasks')}
                    color="destructive"
                    loading={isLoading}
                />
                <StatCell
                    value={stats.awaitingApprovalTasks.length}
                    label="Awaiting"
                    onClick={() => setDetailView('awaiting-tasks')}
                    color="amber"
                    loading={isLoading}
                    last
                />
            </div>

            {/* Action Row */}
            <div className="grid gap-6 lg:grid-cols-2">

                {/* Needs Attention */}
                <Card className="flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Needs Attention</CardTitle>
                        <CardDescription>Tasks requiring immediate action.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                            </div>
                        ) : stats.overdueTasks.length === 0 && stats.awaitingApprovalTasks.length === 0 ? (
                            <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-40" />
                                You're all caught up.
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {stats.overdueTasks.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-1">
                                            Overdue · {stats.overdueTasks.length}
                                        </p>
                                        {stats.overdueTasks.slice(0, 5).map(t => (
                                            <TaskRow key={t.id} task={t} variant="overdue" />
                                        ))}
                                    </div>
                                )}
                                {stats.awaitingApprovalTasks.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                                            Awaiting Approval · {stats.awaitingApprovalTasks.length}
                                        </p>
                                        {stats.awaitingApprovalTasks.slice(0, 4).map(t => (
                                            <TaskRow key={t.id} task={t} variant="awaiting" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                    <CardHeader className="pt-0">
                        <Button variant="link" className="px-0 h-auto justify-start text-xs text-muted-foreground" asChild>
                            <Link href="/my-tasks">View all my tasks <ArrowRight className="ml-1 h-3 w-3" /></Link>
                        </Button>
                    </CardHeader>
                </Card>

                {/* Coming Up */}
                <Card className="flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Coming Up</CardTitle>
                        <CardDescription>Your tasks for the next 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                            </div>
                        ) : stats.upcomingGrouped.length === 0 ? (
                            <div className="py-10 text-center text-muted-foreground text-sm">
                                Nothing scheduled for the next 7 days.
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {stats.upcomingGrouped.map(group => (
                                    <div key={group.label}>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                            {group.label}
                                        </p>
                                        {group.tasks.map(t => (
                                            <TaskRow key={t.id} task={t} variant="upcoming" />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    <CardHeader className="pt-0">
                        <Button variant="link" className="px-0 h-auto justify-start text-xs text-muted-foreground" asChild>
                            <Link href="/my-tasks">View all my tasks <ArrowRight className="ml-1 h-3 w-3" /></Link>
                        </Button>
                    </CardHeader>
                </Card>
            </div>

            {/* Insight Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                <TeamWorkloadChart
                    workspaceId={selectedWorkspace?.id ?? ''}
                    members={workspaceMembers}
                />
                <ProjectDeadlinesChart
                    projects={allWorkspaceProjects}
                    isLoading={isProjectsLoading}
                />
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { selectedWorkspace } = useSelectedWorkspace();

    if (!selectedWorkspace) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Welcome to SaturnSync</CardTitle>
                        <CardDescription>Select a workspace from the sidebar to get started, or create a new one.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AddWorkspaceDialog open={false} onOpenChange={() => {}} />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <DashboardView />;
}
