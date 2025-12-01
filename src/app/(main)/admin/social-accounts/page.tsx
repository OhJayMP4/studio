
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbLink } from '@/components/ui/breadcrumb';
import { CompanySelector } from '@/components/social/company-selector';
import { useFirestore } from '@/firebase';
import type { SocialAccount } from '@/lib/types';
import { listSocialAccounts } from '@/lib/social-accounts';
import { SocialAccountCard } from '@/components/social/social-account-card';
import { Skeleton } from '@/components/ui/skeleton';

function SocialAccountsBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">Social Accounts</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function SocialAccountsPage() {
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const firestore = useFirestore();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedCompanyId || !firestore || !selectedWorkspace) {
      setAccounts([]);
      return;
    }
    
    setIsLoading(true);
    listSocialAccounts(firestore, selectedWorkspace.id, selectedCompanyId)
      .then(setAccounts)
      .finally(() => setIsLoading(false));
  }, [selectedCompanyId, firestore, selectedWorkspace]);

  if (!isUserAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Permission Denied</CardTitle>
            <CardDescription>You must be an admin to manage social accounts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleAccountUpdate = () => {
    if (!selectedCompanyId || !firestore || !selectedWorkspace) return;
    setIsLoading(true);
    listSocialAccounts(firestore, selectedWorkspace.id, selectedCompanyId)
      .then(setAccounts)
      .finally(() => setIsLoading(false));
  };

  const platforms: SocialAccount['platform'][] = ['facebook', 'instagram', 'linkedin', 'x'];

  const accountsByPlatform = useMemo(() => {
    const map = new Map<SocialAccount['platform'], SocialAccount>();
    accounts.forEach(acc => map.set(acc.platform, acc));
    return map;
  }, [accounts]);

  return (
    <div className="space-y-6">
      <SocialAccountsBreadcrumb />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline">Social Media Accounts</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Connections</CardTitle>
          <CardDescription>Connect or update social media accounts for a company.</CardDescription>
          <div className="pt-4 w-full md:w-1/3">
            <CompanySelector
              selectedCompanyId={selectedCompanyId}
              onCompanyChange={setSelectedCompanyId}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!selectedCompanyId ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Please select a company to manage its social accounts.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {platforms.map(platform => (
                <SocialAccountCard
                  key={platform}
                  platform={platform}
                  companyId={selectedCompanyId}
                  account={accountsByPlatform.get(platform)}
                  onAccountUpdate={handleAccountUpdate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
