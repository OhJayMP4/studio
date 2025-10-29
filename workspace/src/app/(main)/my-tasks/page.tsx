
'use client';

import { useUserTasks } from "@/hooks/use-user-tasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { List, Grid } from "lucide-react";
import { TaskGridItem } from "@/components/common/task-grid-item";
import { TaskList } from "@/components/common/task-list";
import { useSelectedWorkspace } from "../layout";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";

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
    const { selectedWorkspace } = useSelectedWorkspace();
    const { tasks, isLoading, error } = useUserTasks(selectedWorkspace?.id);
    const [view, setView] = useState<'active' | 'completed'>('active');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    if (!selectedWorkspace) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>My Tasks</CardTitle>
                    <CardDescription>Please select a workspace from the sidebar to view your assigned tasks.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <AddWorkspaceDialog open={false} onOpenChange={() => {}} />
                </CardContent>
                </Card>
            </div>
        );
    }

    const tasksToShow = view === 'active' ? tasks.active : tasks.completed;

    return (
        <div className="space-y-6">
            <MyTasksBreadcrumb />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-headline">My Tasks</h1>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <CardTitle>Your Assigned Tasks for {selectedWorkspace.name}</CardTitle>
                            <CardDescription>All tasks assigned to you in this workspace.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="flex gap-1 bg-muted p-1 rounded-md w-full sm:w-fit">
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
                             <div className="flex gap-1 bg-muted p-1 rounded-md">
                                <Button
                                    size="sm"
                                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                    onClick={() => setViewMode('grid')}
                                    className="h-8 w-8 p-0"
                                >
                                    <Grid className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                    onClick={() => setViewMode('list')}
                                    className="h-8 w-8 p-0"
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading && (
                        <div className="space-y-4">
                           <Skeleton className="h-24 w-full" />
                           <Skeleton className="h-24 w-full" />
                           <Skeleton className="h-24 w-full" />
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
                        <div>
                             {viewMode === 'grid' ? (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {tasksToShow.map(userTask => (
                                        <TaskGridItem key={userTask.id} userTask={userTask} />
                                    ))}
                                </div>
                            ) : (
                                <TaskList tasks={tasksToShow} />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
