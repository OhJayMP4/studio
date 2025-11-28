'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SocialPost, SocialPlatform, SocialPostStatusType } from '@/lib/types';
import { format } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { CreatePostDialog } from './create-post-dialog';
import { DeleteDialog } from '../common/delete-dialog';
import { useFirestore, useSelectedWorkspace } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { deleteSocialPost } from '@/lib/social-posts';

interface PostDetailsSheetProps {
  post: SocialPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostChange: () => void;
}

const statusColors: Record<SocialPostStatusType, string> = {
    draft: 'bg-gray-400',
    pending_approval: 'bg-orange-400',
    approved: 'bg-blue-500',
    scheduled: 'bg-blue-500',
    published: 'bg-green-500',
    failed: 'bg-red-500',
    rejected: 'bg-red-500',
};

const platformNames: Record<SocialPlatform, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    x: 'X (Twitter)',
}

export function PostDetailsSheet({ post, open, onOpenChange, onPostChange }: PostDetailsSheetProps) {
  const firestore = useFirestore();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  if (!post) return null;

  const canEdit = post.status === 'draft' || post.status === 'rejected';

  const handleDelete = async () => {
    if (!firestore || !selectedWorkspace) return;
    try {
        await deleteSocialPost(firestore, selectedWorkspace.id, post.companyId, post);
        toast({ title: 'Post deleted successfully' });
        onOpenChange(false);
        onPostChange();
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Failed to delete post', description: error.message });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Post Details</SheetTitle>
          <SheetDescription>
            Scheduled for {format(new Date((post.scheduledAt as any).seconds * 1000), 'PPP p')}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="py-4 space-y-6">
                <div className="space-y-1">
                    <h3 className="font-semibold text-lg">Status</h3>
                    <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", statusColors[post.status])} />
                        <span className="capitalize">{post.status.replace('_', ' ')}</span>
                    </div>
                     {post.status === 'rejected' && post.rejectionReason && (
                        <p className="text-sm text-destructive pl-5">Reason: {post.rejectionReason}</p>
                    )}
                </div>
                <Separator />

                <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Platforms</h3>
                    <div className="flex flex-wrap gap-2">
                        {post.platforms.map(p => <Badge key={p}>{platformNames[p]}</Badge>)}
                    </div>
                </div>
                <Separator />

                 <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Media</h3>
                     {post.media && post.media.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                            {post.media.map((m, index) => (
                                <div key={index} className="relative aspect-square">
                                    <Image src={m.fileUrl} alt={`media ${index + 1}`} layout="fill" className="rounded-md object-cover" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No media attached.</p>
                    )}
                </div>
                <Separator />
                
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Captions</h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Default</p>
                            <p className="text-sm p-2 bg-muted rounded-md whitespace-pre-wrap">{post.captionDefault}</p>
                        </div>
                        {post.captionFacebook && <div>
                            <p className="text-sm font-medium text-muted-foreground">Facebook</p>
                            <p className="text-sm p-2 bg-muted rounded-md whitespace-pre-wrap">{post.captionFacebook}</p>
                        </div>}
                         {post.captionInstagram && <div>
                            <p className="text-sm font-medium text-muted-foreground">Instagram</p>
                            <p className="text-sm p-2 bg-muted rounded-md whitespace-pre-wrap">{post.captionInstagram}</p>
                        </div>}
                         {post.captionLinkedin && <div>
                            <p className="text-sm font-medium text-muted-foreground">LinkedIn</p>
                            <p className="text-sm p-2 bg-muted rounded-md whitespace-pre-wrap">{post.captionLinkedin}</p>
                        </div>}
                         {post.captionX && <div>
                            <p className="text-sm font-medium text-muted-foreground">X</p>
                            <p className="text-sm p-2 bg-muted rounded-md whitespace-pre-wrap">{post.captionX}</p>
                        </div>}
                    </div>
                </div>
            </div>
        </ScrollArea>
        <SheetFooter className='gap-2 sm:justify-between'>
            <DeleteDialog onConfirm={handleDelete} itemName={`the post scheduled for ${format(new Date((post.scheduledAt as any).seconds * 1000), 'PPP')}`}>
                 <Button variant="destructive" className='w-full sm:w-auto'>Delete Post</Button>
            </DeleteDialog>
            <div className='flex gap-2 w-full sm:w-auto'>
                <Button onClick={() => onOpenChange(false)} variant="outline" className='w-full sm:w-auto'>Close</Button>
                <CreatePostDialog
                    companyId={post.companyId}
                    onPostCreated={() => {
                        onOpenChange(false); // Close details sheet
                        onPostChange(); // Refresh calendar
                    }}
                    postToEdit={post}
                >
                    <Button disabled={!canEdit} className='w-full sm:w-auto'>Edit Post</Button>
                </CreatePostDialog>
            </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
