
'use client';

import React from 'react';
import { SocialPost, SocialPostStatusType, SocialPlatform } from '@/lib/types';
import { format } from 'date-fns';
import { Card } from '../ui/card';
import { cn } from '@/lib/utils';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

interface PostCardProps {
  post: SocialPost;
  onPostSelect: (post: SocialPost) => void;
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

const platformIcons: Record<SocialPlatform, string> = {
    facebook: 'F',
    instagram: 'I',
    linkedin: 'L',
    x: 'X',
}

export function PostCard({ post, onPostSelect }: PostCardProps) {
  const scheduledTime = format(new Date((post.scheduledAt as any).seconds * 1000), 'HH:mm');

  return (
    <Card 
        className="p-1.5 rounded-md hover:shadow-md cursor-pointer text-xs"
        onClick={() => onPostSelect(post)}
    >
        <div className="flex justify-between items-center">
            <span>{scheduledTime}</span>
            <div className="flex items-center gap-1">
                {post.platforms.map(platform => (
                    <span key={platform} className="text-muted-foreground font-bold">{platformIcons[platform]}</span>
                ))}
            </div>
        </div>
      <div className="flex items-center gap-2 mt-1">
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColors[post.status])} />
                </TooltipTrigger>
                <TooltipContent>
                    <p>{post.status.replace('_', ' ')}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
        <p className="truncate flex-1">{post.captionDefault}</p>
      </div>
    </Card>
  );
}
