'use client';

import React from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Company } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '../ui/skeleton';

interface CompanySelectorProps {
  selectedCompanyId: string | null;
  onCompanyChange: (companyId: string) => void;
}

export function CompanySelector({ selectedCompanyId, onCompanyChange }: CompanySelectorProps) {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
  }, [firestore, selectedWorkspace]);

  const { data: companies, isLoading } = useCollection<Company>(companiesQuery);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Select value={selectedCompanyId ?? undefined} onValueChange={onCompanyChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a company..." />
      </SelectTrigger>
      <SelectContent>
        {companies && companies.length > 0 ? (
          companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No companies found.
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
