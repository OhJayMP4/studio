'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Company } from "@/lib/types";
import { AddCompanyDialog } from "@/components/common/add-company-dialog";
import { Button } from "@/components/ui/button";

function WorkspaceView() {
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const firestore = useFirestore();

  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
  }, [firestore, selectedWorkspace]);

  const { data: companies, isLoading } = useCollection<Company>(companiesQuery);

  if (isLoading) {
    return <div>Loading companies...</div>;
  }

  if (!companies || companies.length === 0) {
    return (
      <Card className="w-full max-w-md text-center mx-auto">
        <CardHeader>
          <CardTitle>No Companies Found</CardTitle>
          <CardDescription>Get started by adding your first company to this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {isUserAdmin ? (
            <AddCompanyDialog>
              <Button>Add Company</Button>
            </AddCompanyDialog>
          ) : (
            <p className="text-sm text-muted-foreground">You do not have permission to add companies.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
         <h1 className="text-3xl font-headline">Companies</h1>
         {isUserAdmin && <AddCompanyDialog />}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <Card key={company.id}>
            <CardHeader>
              <CardTitle>{company.name}</CardTitle>
              <CardDescription>{company.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const { selectedWorkspace } = useSelectedWorkspace();

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Welcome to SaturnSync</CardTitle>
            <CardDescription>Select a workspace from the sidebar to get started, or create a new one.</CardDescription>
          </CardHeader>
          <CardContent>
             <AddWorkspaceDialog />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <WorkspaceView />;
}
