'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

interface TeamMember {
    uid: string;
    name: string | null;
}

interface TeamWorkloadChartProps {
    workspaceId: string;
    members: TeamMember[];
}

const chartConfig = {
    tasks: { label: 'Active Tasks', color: 'hsl(var(--primary))' },
};

export function TeamWorkloadChart({ workspaceId, members }: TeamWorkloadChartProps) {
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<{ name: string; tasks: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const memberMap = useMemo(() => {
        const map: Record<string, string> = {};
        members.forEach(m => {
            map[m.uid] = (m.name || 'Unknown').split(' ')[0];
        });
        return map;
    }, [members]);

    useEffect(() => {
        if (!workspaceId || !firestore || members.length === 0) {
            setIsLoading(false);
            return;
        }

        const fetchWorkload = async () => {
            setIsLoading(true);
            try {
                // Query each member's denormalized user-tasks collection — no composite index needed
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
                        if (snap.size > 0) {
                            counts[member.uid] = snap.size;
                        }
                    })
                );

                const result = Object.entries(counts)
                    .map(([uid, tasks]) => ({
                        name: memberMap[uid] ?? uid.slice(0, 8),
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
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Team Workload</CardTitle>
                </div>
                <CardDescription>Active tasks per team member — who needs support.</CardDescription>
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No active tasks found across the workspace.
                    </p>
                ) : (
                    <ChartContainer config={chartConfig} className="h-52 w-full">
                        <BarChart
                            layout="vertical"
                            data={chartData}
                            margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
                        >
                            <CartesianGrid horizontal={false} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                width={72}
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
                            <Bar dataKey="tasks" fill="var(--color-tasks)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
