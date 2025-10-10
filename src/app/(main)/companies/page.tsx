'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, deleteDoc } from "firebase/firestore";
import type { Company } from "@/lib/types";
import { AddCompanyDialog } from "@/components/common/add-company-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { EditCompanyDialog } from "@/components/common/edit-company-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CompanyProgressCard } from "@/components/common/company-progress-card";


function CompaniesBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">Companies</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function CompanyActions({ company }: { company: Company }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { selectedWorkspace } = useSelectedWorkspace();

    const handleDelete = async () => {
        if (!selectedWorkspace) return;
        const companyRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', company.id);
        try {
            await deleteDoc(companyRef);
            toast({
                title: "Company Deleted",
                description: `"${company.name}" has been deleted.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Error Deleting Company",
                description: error.message,
            });
        }
    };

    return (
        <div className="absolute top-2 right-2 z-10">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <EditCompanyDialog company={company}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            Edit
                        </DropdownMenuItem>
                    </EditCompanyDialog>
                    <DeleteDialog onConfirm={handleDelete} itemName={company.name}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                            Delete
                        </DropdownMenuItem>
                    </DeleteDialog>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function WorkspaceView() {
  const { selectedWorkspace } = useSelectedWorkspace();
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
          <AddCompanyDialog>
              <Button>Add Company</Button>
          </AddCompanyDialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
        <CompaniesBreadcrumb />
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-headline">Companies</h1>
            <AddCompanyDialog />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
                <CompanyProgressCard key={company.id} company={company}>
                    <CompanyActions company={company} />
                </CompanyProgressCard>
            ))}
        </div>
    </div>
  );
}


export default function CompaniesPage() {
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
