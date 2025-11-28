
'use client';

import React from 'react';
import { DayPicker, DayProps } from 'react-day-picker';
import { isSameDay, isToday } from 'date-fns';
import { SocialPost } from '@/lib/types';
import { PostItem } from './post-item';
import { cn } from '@/lib/utils';

interface SchedulerCalendarProps {
  posts: SocialPost[];
  onPostSelect: (post: SocialPost) => void;
  onMonthChange: (month: Date) => void;
  onDayClick: (date: Date) => void;
}

// Max posts to show in month view before "+X more"
const MAX_POSTS_PER_DAY = 3;

function CustomDay(
  props: DayProps & {
    postsForDay: {
      posts: SocialPost[];
      onPostSelect: (post: SocialPost) => void;
      onDayClick: (date: Date) => void;
    };
  }
) {
  const { postsForDay, date } = props;
  const { posts, onPostSelect, onDayClick } = postsForDay;

  const sortedPosts = posts.sort(
    (a, b) => (a.scheduledAt as any).seconds - (b.scheduledAt as any).seconds
  );

  const visiblePosts = sortedPosts.slice(0, MAX_POSTS_PER_DAY);
  const hiddenCount = sortedPosts.length - visiblePosts.length;
  
  const handleDayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if the click was on a post item. If so, let the post item handle it.
    if ((e.target as HTMLElement).closest('[data-post-item]')) {
      return;
    }
    // Otherwise, it was a click on the day cell itself.
    onDayClick(date);
  };


  return (
    <div 
        className="h-28 w-full p-1 relative flex flex-col cursor-pointer"
        onClick={handleDayClick}
    >
      {/* Day number */}
      <span className={cn("text-xs self-end pr-1", { "text-primary font-bold": isToday(date) })}>
        {props.date.getDate()}
      </span>

      {/* Posts */}
      <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
        {visiblePosts.map((post: SocialPost) => (
          <div key={post.id} data-post-item="true">
            <PostItem post={post} onPostSelect={onPostSelect} />
          </div>
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            className="text-[10px] text-muted-foreground mt-0.5 text-left hover:underline"
            onClick={(e) => {
                e.stopPropagation();
                onDayClick(date);
            }}
          >
            +{hiddenCount} more…
          </button>
        )}
      </div>
    </div>
  );
}

export function SchedulerCalendar({
  posts,
  onPostSelect,
  onMonthChange,
  onDayClick
}: SchedulerCalendarProps) {
  const components = {
    Day: (props: DayProps) => {
      const postsForDay = posts.filter((post) =>
        isSameDay(new Date((post.scheduledAt as any).seconds * 1000), props.date)
      );

      return (
        <CustomDay
          {...props}
          postsForDay={{ posts: postsForDay, onPostSelect, onDayClick }}
        />
      );
    },
  };

  return (
    <div className="border rounded-md">
      <DayPicker
        numberOfMonths={1}
        mode="single"
        onMonthChange={onMonthChange}
        className="w-full"
        classNames={{
          months:
            'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full',
          month: 'space-y-4 w-full',
          table: 'w-full border-collapse space-y-1',
          head_row: 'flex w-full',
          head_cell:
            'text-muted-foreground rounded-md w-full font-normal text-sm',
          row: 'flex w-full mt-2',
          cell:
            'h-28 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 w-full border',
        }}
        components={components}
      />
    </div>
  );
}
