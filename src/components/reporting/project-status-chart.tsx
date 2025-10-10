'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { Project } from "@/lib/types";
import { collectionGroup, getDocs, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";


export default function ProjectStatusChart({ workspaceId }: { workspaceId: string }) {
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const projectsQuery = query(collectionGroup(firestore, 'projects'));
            const projectsSnap = await getDocs(projectsQuery);
            
            let notStarted = 0;
            let inProgress = 0;
            let completed = 0;

            projectsSnap.docs.forEach(doc => {
                // This is a simplification. In a real app, you'd check if the project belongs to the workspace.
                // For now, we assume all projects are in the current workspace for demo purposes.
                const project = doc.data() as Project;
                 if (project.progress === 0) {
                    notStarted++;
                } else if (project.progress > 0 && project.progress < 100) {
                    inProgress++;
                } else {
                    completed++;
                }
            });

            setChartData([
                { status: 'Not Started', count: notStarted, fill: 'var(--color-notStarted)' },
                { status: 'In Progress', count: inProgress, fill: 'var(--color-inProgress)' },
                { status: 'Completed', count: completed, fill: 'var(--color-completed)' },
            ]);
            setIsLoading(false);
        };
        fetchData();
    }, [firestore, workspaceId]);
    
    const chartConfig = {
        count: {
            label: 'Projects',
        },
        notStarted: {
            label: 'Not Started',
            color: 'hsl(var(--chart-1))',
        },
        inProgress: {
            label: 'In Progress',
            color: 'hsl(var(--chart-2))',
        },
        completed: {
            label: 'Completed',
            color: 'hsl(var(--chart-3))',
        },
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Project Status</CardTitle>
                <CardDescription>Overview of all projects by completion status.</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-48 w-full">
                    <BarChart accessibilityLayer data={chartData} margin={{ top: 20 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="status"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(value) => value.slice(0, 3)}
                        />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
