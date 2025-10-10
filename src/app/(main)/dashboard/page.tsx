'use client';

import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Workspace } from "@/lib/types";

export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const workspacesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, "workspaces"),
      where("memberIds", "array-contains", user.uid)
    );
  }, [firestore, user]);

  const { data: workspaces, isLoading, error } = useCollection<Workspace>(workspacesQuery);

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-headline">Dashboard</h1>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    // This will be caught by the error boundary
    throw error;
  }
  
  if (workspaces && workspaces.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Welcome to SaturnSync</CardTitle>
            <CardDescription>Create your first workspace to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <AddWorkspaceDialog />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-headline">Workspaces</h1>
            <AddWorkspaceDialog />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces?.map((workspace) => (
                <Card key={workspace.id}>
                    <CardHeader>
                        <CardTitle>{workspace.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">You are an {workspace.users[user?.uid || '']?.role} in this workspace.</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}