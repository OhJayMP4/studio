
'use client';

import React from 'react';
import { SocialPost, SocialPostStatusType, SocialPlatform } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

interface PostItemProps {
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

export function PostItem({ post, onPostSelect }: PostItemProps) {
  const scheduledTime = format(new Date((post.scheduledAt as any).seconds * 1000), 'HH:mm');
  const truncatedCaption = post.captionDefault.length > 15
    ? `${post.captionDefault.substring(0, 15)}...`
    : post.captionDefault;

  return (
    <div 
        className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent cursor-pointer text-xs"
        onClick={() => onPostSelect(post)}
    >
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

        <span className="font-semibold text-muted-foreground">{scheduledTime}</span>
        
        <p className="flex-1 min-w-0" title={post.captionDefault}>{truncatedCaption}</p>

        <div className="flex items-center gap-1 flex-shrink-0">
            {post.platforms.map(platform => (
                <span key={platform} className="text-muted-foreground font-bold text-[10px]">{platformIcons[platform]}</span>
            ))}
        </div>
    </div>
  );
}
