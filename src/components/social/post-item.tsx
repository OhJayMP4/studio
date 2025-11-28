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
};

export function PostItem({ post, onPostSelect }: PostItemProps) {
  const scheduledTime = format(
    new Date((post.scheduledAt as any).seconds * 1000),
    'HH:mm'
  );

  // Make the preview very short in the calendar
  const MAX_LEN = 25;
  const fullCaption = post.captionDefault || '';
  const previewCaption =
    fullCaption.length > MAX_LEN
      ? fullCaption.slice(0, MAX_LEN).trim() + '...'
      : fullCaption;

  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-accent cursor-pointer text-[11px] w-full overflow-hidden"
      onClick={(e) => {
          e.stopPropagation();
          onPostSelect(post)
      }}
    >
      {/* Left: Status dot + time */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  statusColors[post.status]
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="capitalize">{post.status.replace('_', ' ')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="font-semibold text-muted-foreground">
          {scheduledTime}
        </span>
      </div>

      {/* Middle: Truncated caption */}
      <div className="flex-grow min-w-0">
        <p
          className="overflow-hidden whitespace-nowrap text-ellipsis"
          title={post.captionDefault}
        >
          {previewCaption}
        </p>
      </div>

      {/* Right: platforms */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {post.platforms.map((platform) => (
          <span
            key={platform}
            className="text-muted-foreground font-bold text-[9px]"
          >
            {platformIcons[platform]}
          </span>
        ))}
      </div>
    </div>
  );
}
