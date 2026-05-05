'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Project } from '@/lib/types';
import { format, isPast, isToday, differenceInDays, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarClock, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface ProjectDeadlinesChartProps {
    projects: Project[];
    isLoading: boolean;
}

export function ProjectDeadlinesChart({ projects, isLoading }: ProjectDeadlinesChartProps) {
    const pipeline = useMemo(() => {
        const now = new Date();
        return projects
            .filter(p =>
                p.id !== 'general-tasks' &&
                p.status !== 'archived' &&
                p.status !== 'completed' &&
                p.progress < 100 &&
                p.deadline
            )
            .filter(p => differenceInDays(new Date(p.deadline), now) > -14) // exclude very stale
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
            .slice(0, 7);
    }, [projects]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-56 mt-1" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Project Pipeline</CardTitle>
                </div>
                <CardDescription>Active projects sorted by upcoming deadline.</CardDescription>
            </CardHeader>
            <CardContent>
                {pipeline.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No active projects with upcoming deadlines.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pipeline.map(project => {
                            const deadline = new Date(project.deadline);
                            const daysLeft = differenceInDays(deadline, new Date());
                            const overdue = isPast(deadline) && !isToday(deadline);
                            const urgent = !overdue && daysLeft <= 7;

                            return (
                                <Link
                                    key={project.id}
                                    href={`/company/${project.companyId}/project/${project.id}`}
                                    className="block group"
                                >
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium truncate group-hover:underline">
                                                {project.name}
                                            </span>
                                            <span className={cn(
                                                "text-xs font-semibold shrink-0 tabular-nums",
                                                overdue ? "text-destructive" : urgent ? "text-amber-600" : "text-muted-foreground"
                                            )}>
                                                {overdue
                                                    ? `${Math.abs(daysLeft)}d overdue`
                                                    : daysLeft === 0
                                                        ? 'Due today'
                                                        : `${daysLeft}d left`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all",
                                                        overdue ? "bg-destructive" : urgent ? "bg-amber-500" : "bg-primary"
                                                    )}
                                                    style={{ width: `${project.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right shrink-0">
                                                {project.progress}%
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {format(deadline, 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
