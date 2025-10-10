'use client';

import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import type { Workspace } from "@/lib/types";
import { doc } from "firebase/firestore";
import { useParams } from "next/navigation";
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProjectStatusChart from "@/components/reporting/project-status-chart";
import TaskPriorityChart from "@/components/reporting/task-priority-chart";

function LiveReportLoader() {
    return (
        <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                    <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                    <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                </div>
                <Card>
                    <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
                    <CardContent><Skeleton className="h-64 w-full" /></CardContent>
                </Card>
            </div>
        </div>
    )
}


export default function LiveReportPage() {
    const params = useParams();
    const workspaceId = params.workspaceId as string;
    const firestore = useFirestore();

    const workspaceRef = useMemoFirebase(() => {
        if (!workspaceId) return null;
        return doc(firestore, 'workspaces', workspaceId);
    }, [firestore, workspaceId]);

    const { data: workspace, isLoading } = useDoc<Workspace>(workspaceRef);
    
    if (isLoading || !workspace) {
        return <LiveReportLoader />;
    }

    return (
        <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header>
                    <h1 className="text-4xl font-bold font-headline">Live CEO Report: {workspace.name}</h1>
                    <p className="text-muted-foreground">Last updated: {format(new Date(), 'PPP p')}</p>
                </header>

                <main className="space-y-8">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                       <ProjectStatusChart workspaceId={workspaceId} />
                       <TaskPriorityChart workspaceId={workspaceId} />
                         <Card>
                            <CardHeader>
                                <CardTitle>Coming Soon</CardTitle>
                                <CardDescription>More charts and data visualizations are on the way.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center h-48">
                                <p className="text-muted-foreground">Placeholder</p>
                            </CardContent>
                        </Card>
                    </div>
                     <Card>
                        <CardHeader>
                            <CardTitle>Projects Drill-Down</CardTitle>
                            <CardDescription>A table with all projects will be here to allow drilling down.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center h-64">
                             <p className="text-muted-foreground">Placeholder for interactive project table.</p>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </div>
    );
}
