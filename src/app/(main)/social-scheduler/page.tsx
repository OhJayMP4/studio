
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
import { SocialPost } from '@/lib/types';
import { PostDetailsSheet } from '@/components/social/post-details-sheet';
import { useFirestore } from '@/firebase';
import { listSocialPostsByCompany } from '@/lib/social-posts';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { CreatePostDialog } from '@/components/social/create-post-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

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
  const firestore = useFirestore();
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string | null>(null);
  const [selectedPost, setSelectedPost] = React.useState<SocialPost | null>(null);

  const [posts, setPosts] = React.useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [selectedDateForCreate, setSelectedDateForCreate] = React.useState<Date | undefined>();

  const fetchPosts = React.useCallback(async () => {
    if (!selectedCompanyId || !firestore || !selectedWorkspace) {
      setPosts([]);
      return;
    }
    setIsLoading(true);
    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);
    try {
      const fetchedPosts = await listSocialPostsByCompany(
        firestore,
        selectedCompanyId,
        selectedWorkspace.id,
        startDate,
        endDate
      );
      setPosts(fetchedPosts);
    } catch (error) {
      console.error("Failed to fetch social posts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompanyId, currentMonth, firestore, selectedWorkspace]);

  React.useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDayClick = (date: Date) => {
    setSelectedDateForCreate(date);
    setIsCreateDialogOpen(true);
  };

  const handlePostCreated = () => {
    fetchPosts(); // Refetch posts after one is created/updated
  }

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
         {selectedCompanyId && (
          <CreatePostDialog 
            companyId={selectedCompanyId} 
            onPostCreated={handlePostCreated}
          >
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Post
            </Button>
          </CreatePostDialog>
        )}
      </div>
      
      <Card>
        <CardHeader>
            <div className="w-full md:w-1/3">
                <CompanySelector
                    selectedCompanyId={selectedCompanyId}
                    onCompanyChange={(id) => {
                      setSelectedCompanyId(id);
                      setPosts([]); // Clear posts when company changes
                    }}
                />
            </div>
        </CardHeader>
        <CardContent>
            {selectedCompanyId ? (
                <>
                    {isLoading ? (
                        <div className="border rounded-md p-4">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-6 w-24" />
                            </div>
                            <div className="grid grid-cols-7 gap-px mt-4">
                                {[...Array(35)].map((_, i) => (
                                    <Skeleton key={i} className="h-24" />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <SchedulerCalendar 
                            posts={posts} 
                            onPostSelect={setSelectedPost}
                            onMonthChange={setCurrentMonth}
                            onDayClick={handleDayClick}
                        />
                    )}
                </>
            ) : (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">Please select a company to view the schedule.</p>
                </div>
            )}
        </CardContent>
      </Card>
      
      {selectedCompanyId && <CreatePostDialog 
        companyId={selectedCompanyId}
        onPostCreated={handlePostCreated}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        selectedDate={selectedDateForCreate}
      />}
      
      <PostDetailsSheet 
        post={selectedPost}
        open={!!selectedPost}
        onOpenChange={(isOpen) => {
            if (!isOpen) {
                setSelectedPost(null);
            }
        }}
        onPostUpdated={handlePostCreated}
      />
    </div>
  );
}
