'use client';

import { useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { notFound } from "next/navigation";
import { TaskList } from "@/components/tasks/task-list";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, CheckCircle2 } from "lucide-react";
import { collection, doc } from "firebase/firestore";
import type { Silo, Task } from "@/lib/types";

export default function SiloPage({ params: { projectId, siloId } }: { params: { workspaceId: string, companyId: string, projectId: string, siloId: string } }) {
    const firestore = useFirestore();

    const siloRef = useMemoFirebase(() => doc(firestore, "projects", projectId, "silos", siloId), [firestore, projectId, siloId]);
    const { data: silo, isLoading: isSiloLoading } = useDoc<Silo>(siloRef);
    
    const tasksRef = useMemoFirebase(() => collection(firestore, "silos", siloId, "tasks"), [firestore, siloId]);
    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksRef);

    if (isSiloLoading || areTasksLoading) {
        return <div>Loading...</div>
    }

    if (!silo) {
        notFound();
    }
    
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.completed).length || 0;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-headline">{silo.name}</h1>
                <p className="text-muted-foreground">Manage and track tasks for this silo.</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalTasks}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{completedTasks}</div>
                    </CardContent>
                </Card>
                <Card className="col-span-1 md:col-span-2 lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                        <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
                    </CardHeader>
                    <CardContent>
                       <Progress value={completionPercentage} aria-label={`${completionPercentage}% complete`} />
                    </CardContent>
                </Card>
            </div>

            <TaskList tasks={tasks || []} siloId={siloId} />
        </div>
    );
}
