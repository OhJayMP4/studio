'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from '../ui/button';
import { Bell, Check, CheckSquare, Folder, Box, Building, UserPlus, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, writeBatch, doc, arrayUnion, updateDoc } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

function useUnreadNotifications() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user } = useUser();
    const firestore = useFirestore();

    const notificationsQuery = useMemoFirebase(() => {
        if (!selectedWorkspace || !user) return null;
        return query(
            collection(firestore, `notifications/${selectedWorkspace.id}/activities`),
            orderBy('timestamp', 'desc'),
            limit(20) // We limit to check recent ones for performance
        );
    }, [firestore, selectedWorkspace, user]);

    const { data, isLoading } = useCollection<Notification>(notificationsQuery);
    
    const unreadCount = useMemo(() => {
        if (!data || !user) return 0;
        return data.filter(n => !n.readBy.includes(user.uid)).length;
    }, [data, user]);

    return { unreadCount, isLoading };
}

export function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useUnreadNotifications();
  const router = useRouter();
  const { selectedWorkspace } = useSelectedWorkspace();

  const handleSeeAllClick = () => {
    setIsOpen(false);
    if (selectedWorkspace) {
        router.push(`/notifications`);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium">Notifications</h3>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={handleSeeAllClick}>
            See all
          </Button>
        </div>
        <NotificationList onNotificationClick={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

const getIcon = (type: Notification['type']) => {
    switch (type) {
        case 'task_assigned': return <UserPlus className="h-4 w-4 text-muted-foreground" />;
        case 'task_completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'silo_added': return <Box className="h-4 w-4 text-muted-foreground" />;
        case 'project_added': return <Folder className="h-4 w-4 text-muted-foreground" />;
        case 'company_added': return <Building className="h-4 w-4 text-muted-foreground" />;
        case 'sale_added': return <FileText className="h-4 w-4 text-muted-foreground" />;
        case 'task_deleted':
        case 'silo_deleted':
        case 'project_deleted':
        case 'company_deleted':
            return <Trash2 className="h-4 w-4 text-destructive" />;
        default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
}

const getNotificationText = (n: Notification) => {
    switch (n.type) {
        case 'company_added':
            return <><span className="font-semibold">{n.actorName}</span> added a new company: <span className="font-semibold">{n.target.name}</span></>;
        case 'project_added':
            return <><span className="font-semibold">{n.actorName}</span> added a new project: <span className="font-semibold">{n.target.name}</span> in {n.context?.companyName}</>;
        case 'silo_added':
            return <><span className="font-semibold">{n.actorName}</span> added a new silo: <span className="font-semibold">{n.target.name}</span> in {n.context?.projectName}</>;
        case 'task_assigned':
            return <><span className="font-semibold">{n.actorName}</span> assigned <span className="font-semibold">{n.target.name}</span> to <span className="font-semibold">{n.assignee?.name}</span></>;
        case 'task_completed':
            return <><span className="font-semibold">{n.actorName}</span> completed the task: <span className="font-semibold">{n.target.name}</span></>;
        case 'sale_added':
            return <><span className="font-semibold">{n.actorName}</span> logged a new sale: <span className="font-semibold">{n.target.name}</span> for {n.context?.projectName}</>;
        case 'company_deleted':
            return <><span className="font-semibold">{n.actorName}</span> deleted the company: <span className="font-semibold">{n.target.name}</span></>;
        case 'project_deleted':
            return <><span className="font-semibold">{n.actorName}</span> deleted the project: <span className="font-semibold">{n.target.name}</span></>;
        case 'silo_deleted':
            return <><span className="font-semibold">{n.actorName}</span> deleted the silo: <span className="font-semibold">{n.target.name}</span></>;
        case 'task_deleted':
            return <><span className="font-semibold">{n.actorName}</span> deleted the task: <span className="font-semibold">{n.target.name}</span></>;
        default:
            return 'New activity';
    }
}

function NotificationList({ onNotificationClick }: { onNotificationClick?: () => void }) {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const notificationsQuery = useMemoFirebase(() => {
        if (!selectedWorkspace || !user) return null;
        return query(
            collection(firestore, `notifications/${selectedWorkspace.id}/activities`),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
    }, [firestore, selectedWorkspace, user]);

    const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);
    
    const handleNotificationClick = async (notification: Notification) => {
        if (!user || !selectedWorkspace) {
            onNotificationClick?.();
            return;
        }

        if (!notification.readBy.includes(user.uid)) {
            const notifRef = doc(firestore, `notifications/${selectedWorkspace.id}/activities/${notification.id}`);
            try {
                // No need to batch for a single update
                await updateDoc(notifRef, {
                    readBy: arrayUnion(user.uid)
                });
            } catch (e) {
                console.error("Error marking notification as read:", e);
            }
        }
        
        if (notification.target.path) {
            router.push(notification.target.path);
        }
        onNotificationClick?.();
    }


    if (isLoading) {
        return <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
    }

    if (!notifications || notifications.length === 0) {
        return <div className="p-4 text-center text-sm text-muted-foreground">No new notifications.</div>
    }
    
    return (
        <ScrollArea className="h-96">
            <div className="flex flex-col">
                {notifications.map((n, index) => (
                    <React.Fragment key={n.id}>
                        <div 
                            className={cn(
                                "flex items-start gap-3 p-4 hover:bg-accent cursor-pointer",
                                user && !n.readBy.includes(user.uid) && "bg-blue-500/10 hover:bg-blue-500/20"
                            )}
                             onClick={() => handleNotificationClick(n)}
                        >
                           <div className="mt-1">{getIcon(n.type)}</div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm">{getNotificationText(n)}</p>
                                <p className="text-xs text-muted-foreground">
                                    {n.timestamp ? formatDistanceToNow(new Date(n.timestamp.seconds * 1000), { addSuffix: true }) : ''}
                                </p>
                            </div>
                             {user && !n.readBy.includes(user.uid) && (
                                <div className="h-2.5 w-2.5 rounded-full bg-blue-500 mt-2" />
                            )}
                        </div>
                        {index < notifications.length - 1 && <Separator />}
                    </React.Fragment>
                ))}
            </div>
        </ScrollArea>
    )
}
