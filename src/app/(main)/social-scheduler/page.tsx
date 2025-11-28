
'use client';

import React from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { CompanySelector } from '@/components/social/company-selector';
import { SchedulerCalendar } from '@/components/social/scheduler-calendar';
import { getMockPosts } from '@/components/social/mock-data';
import { SocialPost } from '@/lib/types';
import { PostDetailsSheet } from '@/components/social/post-details-sheet';

function SocialSchedulerBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">Social Media Scheduler</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function SocialSchedulerPage() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string | null>(null);
  const [selectedPost, setSelectedPost] = React.useState<SocialPost | null>(null);

  // For now, we use mock data. This will be replaced with a Firestore query.
  const posts = selectedCompanyId ? getMockPosts(selectedCompanyId) : [];

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Social Media Scheduler</CardTitle>
            <CardDescription>Please select a workspace to manage social media posts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SocialSchedulerBreadcrumb />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline">Social Media Scheduler</h1>
      </div>
      
      <Card>
        <CardHeader>
            <div className="w-full md:w-1/3">
                <CompanySelector
                    selectedCompanyId={selectedCompanyId}
                    onCompanyChange={setSelectedCompanyId}
                />
            </div>
        </CardHeader>
        <CardContent>
            {selectedCompanyId ? (
                <SchedulerCalendar 
                    posts={posts} 
                    onPostSelect={setSelectedPost}
                />
            ) : (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">Please select a company to view the schedule.</p>
                </div>
            )}
        </CardContent>
      </Card>
      
      <PostDetailsSheet 
        post={selectedPost}
        open={!!selectedPost}
        onOpenChange={(isOpen) => {
            if (!isOpen) {
                setSelectedPost(null);
            }
        }}
      />
    </div>
  );
}
