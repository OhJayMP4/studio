'use client';

import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import type { Workspace, Project, Task } from "@/lib/types";
import { collection, doc, getDocs } from "firebase/firestore";
import { useParams } from "next/navigation";
import { useEffect, useState } from 'react';
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
    const [currentTime, setCurrentTime] = useState(new Date());

    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const workspaceRef = useMemoFirebase(() => {
        if (!workspaceId) return null;
        return doc(firestore, 'workspaces', workspaceId);
    }, [firestore, workspaceId]);

    const { data: workspace, isLoading: isLoadingWorkspace } = useDoc<Workspace>(workspaceRef);

     useEffect(() => {
        if (!workspaceId || !firestore) {
            setIsLoadingData(false);
            return;
        }

        const fetchWorkspaceData = async () => {
            setIsLoadingData(true);
            try {
                const companiesRef = collection(firestore, 'workspaces', workspaceId, 'companies');
                const companiesSnapshot = await getDocs(companiesRef);
                
                let allProjects: Project[] = [];
                let allTasks: Task[] = [];

                for (const companyDoc of companiesSnapshot.docs) {
                    const projectsRef = collection(companyDoc.ref, 'projects');
                    const projectsSnapshot = await getDocs(projectsRef);
                    
                    for (const projectDoc of projectsSnapshot.docs) {
                        allProjects.push({ id: projectDoc.id, ...projectDoc.data() } as Project);
                        
                        const silosRef = collection(projectDoc.ref, 'silos');
                        const silosSnapshot = await getDocs(silosRef);

                        for (const siloDoc of silosSnapshot.docs) {
                            const tasksRef = collection(siloDoc.ref, 'tasks');
                            const tasksSnapshot = await getDocs(tasksRef);
                            tasksSnapshot.forEach(taskDoc => {
                                allTasks.push({ id: taskDoc.id, ...taskDoc.data() } as Task);
                            });
                        }
                    }
                }
                setProjects(allProjects);
                setTasks(allTasks);
            } catch (error) {
                console.error("Error fetching live report data: ", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        
        fetchWorkspaceData();
    }, [workspaceId, firestore]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const isLoading = isLoadingWorkspace || isLoadingData;
    
    if (isLoading || !workspace) {
        return <LiveReportLoader />;
    }

    return (
        <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header>
                    <h1 className="text-4xl font-bold font-headline">Live CEO Report: {workspace.name}</h1>
                    <p className="text-muted-foreground">Last updated: {format(currentTime, 'PPP p')}</p>
                </header>

                <main className="space-y-8">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                       <ProjectStatusChart projects={projects} isLoading={isLoading} />
                       <TaskPriorityChart tasks={tasks} isLoading={isLoading} />
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
