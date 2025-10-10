'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Workspace } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddWorkspaceDialog } from '@/components/common/add-workspace-dialog';
import Link from 'next/link';
import { PlusCircle, Building } from 'lucide-react';

function WorkspaceList({ workspaces }: { workspaces: Workspace[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workspaces.map((workspace) => (
        <Card key={workspace.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {workspace.name}
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {Object.keys(workspace.users || {}).length} members
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-semibold tracking-tight">
        No workspaces found
      </h2>
      <p className="mt-2 text-muted-foreground">
        Get started by creating a new workspace.
      </p>
      <div className="mt-4">
        <AddWorkspaceDialog>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Workspace
            </Button>
        </AddWorkspaceDialog>
      </div>
    </div>
  );
}


export default function DashboardPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const workspacesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
          collection(firestore, 'workspaces'),
          where('memberIds', 'array-contains', user.uid)
        );
    }, [firestore, user]);

    const { data: workspaces, isLoading } = useCollection<Workspace>(workspacesQuery);

    if (isLoading) {
        return <div>Loading workspaces...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {user?.displayName || user?.email}!</p>
                </div>
                {workspaces && workspaces.length > 0 && (
                    <AddWorkspaceDialog>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            New Workspace
                        </Button>
                    </AddWorkspaceDialog>
                )}
            </div>

            {workspaces && workspaces.length > 0 ? <WorkspaceList workspaces={workspaces} /> : <EmptyDashboard />}
        </div>
    );
}
