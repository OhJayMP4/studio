'use client';

import React from 'react';
import { DayPicker, DayProps } from 'react-day-picker';
import { isSameDay } from 'date-fns';
import { SocialPost } from '@/lib/types';
import { PostItem } from './post-item';
import { ScrollArea } from '../ui/scroll-area';

interface SchedulerCalendarProps {
  posts: SocialPost[];
  onPostSelect: (post: SocialPost) => void;
}

function CustomDay(props: DayProps & { postsForDay: { posts: SocialPost[]; onPostSelect: (post: SocialPost) => void; } }) {
    const { postsForDay } = props;
    const { posts, onPostSelect } = postsForDay;

    return (
        <div 
            className="h-32 w-full p-1 relative flex flex-col"
        >
            <span className="text-xs text-muted-foreground self-end pr-1">{props.date.getDate()}</span>
             <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 overflow-hidden p-1">
                    {posts.map((post: SocialPost) => (
                        <PostItem key={post.id} post={post} onPostSelect={onPostSelect} />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

export function SchedulerCalendar({ posts, onPostSelect }: SchedulerCalendarProps) {

    const components = {
        Day: (props: DayProps) => {
            const postsForDay = posts.filter(post => 
                isSameDay(new Date((post.scheduledAt as any).seconds * 1000), props.date)
            );

            return <CustomDay {...props} postsForDay={{posts: postsForDay, onPostSelect}} />;
        }
    }

  return (
    <div className="border rounded-md">
        <DayPicker
            numberOfMonths={1}
            mode="single"
            className="w-full"
            classNames={{
                months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full',
                month: 'space-y-4 w-full',
                table: 'w-full border-collapse space-y-1',
                head_row: 'flex w-full',
                head_cell: 'text-muted-foreground rounded-md w-full font-normal text-sm',
                row: 'flex w-full mt-2',
                cell: 'h-32 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 w-full border',
            }}
            components={components}
        />
    </div>
  );
}
