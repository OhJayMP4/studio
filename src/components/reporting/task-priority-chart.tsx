'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Task } from "@/lib/types";
import { collection, getDocs, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Pie, PieChart, Cell } from "recharts";
import { useFirestore } from "@/firebase";
import { Skeleton } from "../ui/skeleton";

export default function TaskPriorityChart({ workspaceId }: { workspaceId: string }) {
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!workspaceId || !firestore) {
                setIsLoading(false);
                return;
            };
            setIsLoading(true);

            try {
                const companiesRef = collection(firestore, `workspaces/${workspaceId}/companies`);
                const companiesSnap = await getDocs(companiesRef);

                let low = 0;
                let medium = 0;
                let high = 0;

                for (const companyDoc of companiesSnap.docs) {
                     const projectsRef = collection(companyDoc.ref, 'projects');
                     const projectsSnap = await getDocs(query(projectsRef));
                     for (const projectDoc of projectsSnap.docs) {
                        const tasksRef = collection(projectDoc.ref, 'tasks');
                        const tasksSnap = await getDocs(query(tasksRef));
                        tasksSnap.forEach(doc => {
                            const task = doc.data() as Task;
                            if (task.priority === 'low') low++;
                            if (task.priority === 'medium') medium++;
                            if (task.priority === 'high') high++;
                        });
                     }
                }

                setChartData([
                    { priority: 'Low', count: low, fill: 'var(--color-low)' },
                    { priority: 'Medium', count: medium, fill: 'var(--color-medium)' },
                    { priority: 'High', count: high, fill: 'var(--color-high)' },
                ]);
            } catch (error) {
                console.error("Error fetching task priority data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [firestore, workspaceId]);
    
    const chartConfig = {
        count: {
            label: 'Tasks',
        },
        low: {
            label: 'Low',
            color: 'hsl(var(--chart-1))',
        },
        medium: {
            label: 'Medium',
            color: 'hsl(var(--chart-2))',
        },
        high: {
            label: 'High',
            color: 'hsl(var(--chart-3))',
        },
    } satisfies ChartConfig;

    const totalTasks = useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.count, 0);
    }, [chartData]);

     if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Task Priorities</CardTitle>
                <CardDescription>Distribution of all tasks by priority.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                 <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square h-full max-h-[250px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={chartData}
                            dataKey="count"
                            nameKey="priority"
                            innerRadius={60}
                            strokeWidth={5}
                        >
                             {chartData.map((entry) => (
                                <Cell key={`cell-${entry.priority}`} fill={entry.fill} />
                            ))}
                        </Pie>
                         <ChartLegend
                            content={<ChartLegendContent nameKey="priority" />}
                            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/fouro [&>*]:justify-center"
                        />
                    </PieChart>
                </ChartContainer>
            </CardContent>
             <CardContent className="flex flex-col gap-2 text-sm pt-4">
                 <div className="flex items-center justify-between">
                    <span>Total Tasks</span>
                    <span className="font-bold">{totalTasks}</span>
                </div>
            </CardContent>
        </Card>
    )
}
