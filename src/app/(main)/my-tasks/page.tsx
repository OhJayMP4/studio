
'use client';

import { useUser, useFirestore } from "@/firebase";
import { useUserTasks } from "@/hooks/use-user-tasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserTaskItem } from "@/components/common/user-task-item";
import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import type { Workspace } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

function MyTasksBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">My Tasks</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}


export default function MyTasksPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [view, setView] = useState<'active' | 'completed'>('active');
    const { tasks, isLoading, error } = useUserTasks(user?.uid);
    const [isCleaning, setIsCleaning] = useState(false);

    const tasksToShow = view === 'active' ? tasks.active : tasks.completed;
    
    const cleanupInvalidUserTasks = async () => {
        if (!user) return;
        setIsCleaning(true);
        
        const userTasksCollectionRef = collection(firestore, 'user-tasks', user.uid, 'tasks');
        const userTasksSnapshot = await getDocs(userTasksCollectionRef);
        
        const batch = writeBatch(firestore);
        let cleanedCount = 0;
        
        // Use a Map to cache workspace docs to avoid re-fetching for each task
        const workspaceCache = new Map<string, Workspace | null>();
        
        for (const userTaskDoc of userTasksSnapshot.docs) {
            const userTaskData = userTaskDoc.data();
            const { workspaceId } = userTaskData;

            let workspace: Workspace | null = null;
            if (workspaceCache.has(workspaceId)) {
                workspace = workspaceCache.get(workspaceId)!;
            } else {
                const workspaceRef = doc(firestore, 'workspaces', workspaceId);
                const workspaceSnap = await getDoc(workspaceRef);
                if (workspaceSnap.exists()) {
                    workspace = workspaceSnap.data() as Workspace;
                    workspaceCache.set(workspaceId, workspace);
                } else {
                    workspaceCache.set(workspaceId, null);
                }
            }
            
            // If workspace doesn't exist or user is not in the users map, it's an invalid task
            if (!workspace || !workspace.users[user.uid]) {
                batch.delete(userTaskDoc.ref);
                cleanedCount++;
            }
        }
        
        try {
            await batch.commit();
            toast({
                title: "Cleanup Complete",
                description: `${cleanedCount} invalid tasks were removed from your list.`,
            });
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: "Cleanup Failed",
                description: e.message,
            });
        } finally {
            setIsCleaning(false);
        }
    };


    return (
        <div className="space-y-6">
            <MyTasksBreadcrumb />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-headline">My Tasks</h1>
                 {tasks.active.length > 0 || tasks.completed.length > 0 ? (
                    <Button variant="outline" onClick={cleanupInvalidUserTasks} disabled={isCleaning}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isCleaning ? "Cleaning..." : "Clean Invalid Tasks"}
                    </Button>
                ) : null}
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Your Assigned Tasks</CardTitle>
                    <CardDescription>All tasks assigned to you across all projects.</CardDescription>
                    <div className="flex gap-1 bg-muted p-1 rounded-md w-full sm:w-fit mt-2">
                        <Button
                            size="sm"
                            variant={view === 'active' ? 'secondary' : 'ghost'}
                            onClick={() => setView('active')}
                            className="flex-1 h-8"
                        >
                            Active ({tasks.active.length})
                        </Button>
                        <Button
                            size="sm"
                            variant={view === 'completed' ? 'secondary' : 'ghost'}
                            onClick={() => setView('completed')}
                            className="flex-1 h-8"
                        >
                            Completed ({tasks.completed.length})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading && (
                        <div className="space-y-4">
                           <Skeleton className="h-12 w-full" />
                           <Skeleton className="h-12 w-full" />
                           <Skeleton className="h-12 w-full" />
                        </div>
                    )}
                    {!isLoading && error && (
                         <div className="text-center py-8">
                            <p className="text-destructive">Error: {error}</p>
                        </div>
                    )}
                    {!isLoading && !error && tasksToShow.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">
                                {view === 'active' ? "No active tasks. Great job!" : "No completed tasks yet."}
                            </p>
                        </div>
                    )}
                    {!isLoading && !error && tasksToShow.length > 0 && (
                        <div className="divide-y rounded-md border">
                            {tasksToShow.map(userTask => (
                                <UserTaskItem key={userTask.id} userTask={userTask} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
