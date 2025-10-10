'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Task } from "@/lib/types";
import { collectionGroup, getDocs, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Pie, PieChart } from "recharts";
import { useFirestore } from "@/firebase";

export default function TaskPriorityChart({ workspaceId }: { workspaceId: string }) {
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!workspaceId) return;
            setIsLoading(true);

            const tasksQuery = query(
                collectionGroup(firestore, 'tasks'),
                where('__name__', '>=', `workspaces/${workspaceId}/`),
                where('__name__', '<', `workspaces/${workspaceId}/\uf8ff`)
            );
            const tasksSnap = await getDocs(tasksQuery);
            
            let low = 0;
            let medium = 0;
            let high = 0;

            tasksSnap.docs.forEach(doc => {
                const task = doc.data() as Task;
                if (task.priority === 'low') low++;
                if (task.priority === 'medium') medium++;
                if (task.priority === 'high') high++;
            });

            setChartData([
                { priority: 'low', count: low, fill: 'var(--color-low)' },
                { priority: 'medium', count: medium, fill: 'var(--color-medium)' },
                { priority: 'high', count: high, fill: 'var(--color-high)' },
            ]);
            setIsLoading(false);
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
                        </Pie>
                         <ChartLegend
                            content={<ChartLegendContent nameKey="priority" />}
                            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
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
