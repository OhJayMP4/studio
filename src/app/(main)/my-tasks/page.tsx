
'use client';

import { useUser } from "@/firebase";
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
    const [view, setView] = useState<'active' | 'completed'>('active');
    const { tasks, isLoading, error } = useUserTasks(user?.uid);

    const tasksToShow = view === 'active' ? tasks.active : tasks.completed;

    return (
        <div className="space-y-6">
            <MyTasksBreadcrumb />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-headline">My Tasks</h1>
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
