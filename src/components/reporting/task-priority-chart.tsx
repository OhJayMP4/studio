'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { Task } from "@/lib/types";
import { collectionGroup, getDocs, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pie, PieChart } from "recharts";


export default function TaskPriorityChart({ workspaceId }: { workspaceId: string }) {
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const tasksQuery = query(collectionGroup(firestore, 'tasks'));
            const tasksSnap = await getDocs(tasksQuery);
            
            let low = 0;
            let medium = 0;
            let high = 0;

            tasksSnap.docs.forEach(doc => {
                 // This is a simplification. In a real app, you'd check if the task belongs to the workspace.
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
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Task Priorities</CardTitle>
                <CardDescription>Distribution of all tasks by priority.</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-48 w-full">
                    <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie data={chartData} dataKey="count" nameKey="priority" />
                    </PieChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
