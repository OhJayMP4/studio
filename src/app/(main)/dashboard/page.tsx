'use client';

import { Building, PlusCircle } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Company } from '@/lib/types';
import { AddCompanyDialog } from '@/components/common/add-company-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Image from 'next/image';

// This context will be used by the parent layout to provide the selected workspace.
import { useSelectedWorkspace } from '@/app/(main)/layout';

function NoCompaniesState() {
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();

  if (!selectedWorkspace) return null;

  return (
    <div className="flex h-[450px] shrink-0 items-center justify-center rounded-md border border-dashed">
      <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
        <Building className="h-16 w-16 text-muted-foreground" />
        <h3 className="text-2xl font-semibold mt-4">No Companies Yet</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-4">
          Get started by adding your first company to the "{selectedWorkspace.name}" workspace.
        </p>
        {isUserAdmin && (
          <AddCompanyDialog workspaceId={selectedWorkspace.id}>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          </AddCompanyDialog>
        )}
      </div>
    </div>
  );
}

function CompaniesGrid({ companies }: { companies: Company[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <Card key={company.id}>
          <CardHeader className="flex-row items-center gap-4">
            <div className="relative h-12 w-12 shrink-0">
               <Image
                  src={company.logoUrl || `https://picsum.photos/seed/${company.id}/100/100`}
                  alt={`${company.name} logo`}
                  fill
                  className="rounded-lg object-cover"
                />
            </div>
            <CardTitle>{company.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">{company.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


export default function DashboardPage() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();

    const companiesQuery = useMemoFirebase(() => {
        if (!selectedWorkspace) return null;
        return query(collection(firestore, 'workspaces', selectedWorkspace.id, 'companies'));
    }, [firestore, selectedWorkspace]);

    const { data: companies, isLoading } = useCollection<Company>(companiesQuery);

    if (!selectedWorkspace) {
        return (
            <div className="flex h-[450px] shrink-0 items-center justify-center rounded-md border border-dashed">
                <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                    <Building className="h-16 w-16 text-muted-foreground" />
                    <h3 className="text-2xl font-semibold mt-4">Welcome to your Workspace</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        Select a workspace from the switcher in the sidebar to view its companies, or create a new one to get started.
                    </p>
                </div>
            </div>
        );
    }
    
    if (isLoading) {
        return <div>Loading companies...</div>
    }

    if (!companies || companies.length === 0) {
      return <NoCompaniesState />;
    }

    return <CompaniesGrid companies={companies} />;
}
