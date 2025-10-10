'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Task } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Pie, PieChart, Cell } from "recharts";
import { Skeleton } from "../ui/skeleton";

export default function TaskPriorityChart({ tasks, isLoading }: { tasks: Task[], isLoading: boolean }) {
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        if (isLoading || !tasks) return;

        let low = 0;
        let medium = 0;
        let high = 0;

        for (const task of tasks) {
            if (task.priority === 'low') low++;
            if (task.priority === 'medium') medium++;
            if (task.priority === 'high') high++;
        }

        setChartData([
            { priority: 'Low', count: low, fill: 'var(--color-low)' },
            { priority: 'Medium', count: medium, fill: 'var(--color-medium)' },
            { priority: 'High', count: high, fill: 'var(--color-high)' },
        ]);
    }, [tasks, isLoading]);
    
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
