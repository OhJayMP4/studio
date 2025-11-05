'use client';

import React, { useState, useEffect } from 'react';
import { useSelectedWorkspace } from "@/app/(main)/layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, writeBatch, doc, arrayUnion, startAfter, getDocs, updateDoc } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Bell, UserPlus, CheckCircle2, Building, Folder, Box, CheckSquare, FileText, Trash2, MessageSquare } from 'lucide-react';


function NotificationsBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">Notifications</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

const getIcon = (type: Notification['type']) => {
    switch (type) {
        case 'task_assigned': return <UserPlus className="h-5 w-5 text-muted-foreground" />;
        case 'task_completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        case 'silo_added': return <Box className="h-5 w-5 text-muted-foreground" />;
        case 'project_added': return <Folder className="h-5 w-5 text-muted-foreground" />;
        case 'company_added': return <Building className="h-5 w-5 text-muted-foreground" />;
        case 'sale_added': return <FileText className="h-5 w-5 text-muted-foreground" />;
        case 'comment_added': return <MessageSquare className="h-5 w-5 text-muted-foreground" />;
        case 'task_deleted':
        case 'silo_deleted':
        case 'project_deleted':
        case 'company_deleted':
            return <Trash2 className="h-5 w-5 text-destructive" />;
        default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
}

const getNotificationText = (n: Notification) => {
    const commentText = n.context?.commentText;
    const truncatedComment = commentText && commentText.length > 50 ? `${commentText.substring(0, 50)}...` : commentText;

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
         case 'comment_added':
            return <><span className="font-semibold">{n.actorName}</span> commented on <span className="font-semibold">{n.target.name}</span>: <span className="italic text-muted-foreground">"{truncatedComment}"</span></>;
        default:
            return 'New activity';
    }
}


export default function NotificationsPage() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);

    const markAllAsRead = async () => {
        if (!selectedWorkspace || !user) return;
        const batch = writeBatch(firestore);
        notifications.forEach(n => {
            if (!n.readBy.includes(user.uid)) {
                const notifRef = doc(firestore, `notifications/${selectedWorkspace.id}/activities/${n.id}`);
                batch.update(notifRef, { readBy: arrayUnion(user.uid) });
            }
        });
        try {
            await batch.commit();
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    }

    const fetchNotifications = async (loadMore = false) => {
        if (!selectedWorkspace || !user || (!hasMore && loadMore)) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        let q = query(
            collection(firestore, `notifications/${selectedWorkspace.id}/activities`),
            orderBy('timestamp', 'desc'),
            limit(25)
        );

        if (loadMore && lastVisible) {
            q = query(q, startAfter(lastVisible));
        }

        try {
            const documentSnapshots = await getDocs(q);
            const newNotifications = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            
            setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
            setNotifications(prev => loadMore ? [...prev, ...newNotifications] : newNotifications);
            setHasMore(newNotifications.length === 25);

        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        setNotifications([]);
        setLastVisible(null);
        setHasMore(true);
        fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWorkspace]);


    const handleNotificationClick = async (notification: Notification) => {
        if (!user || !selectedWorkspace) return;

        if (!notification.readBy.includes(user.uid)) {
            const notifRef = doc(firestore, `notifications/${selectedWorkspace?.id}/activities/${notification.id}`);
            try {
                await updateDoc(notifRef, { readBy: arrayUnion(user.uid) });
                 // Optimistically update local state
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, readBy: [...n.readBy, user.uid] } : n));
            } catch (e) {
                console.error("Error marking notification as read:", e);
            }
        }
        if (notification.target.path) {
            router.push(notification.target.path);
        }
    }

    return (
        <div className="space-y-6">
            <NotificationsBreadcrumb />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-headline">Activity Log</h1>
                <Button variant="outline" onClick={markAllAsRead}>Mark all as read</Button>
            </div>
            
            <Card>
                <CardContent className="p-0">
                    <div className="flex flex-col">
                        {isLoading && notifications.length === 0 ? (
                             [...Array(5)].map((_, i) => <div key={i} className="p-4 border-b h-20"/>)
                        ) : notifications.length > 0 ? (
                            notifications.map((n) => (
                                <div 
                                    key={n.id}
                                    className={cn(
                                        "flex items-start gap-4 p-4 border-b cursor-pointer hover:bg-accent",
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
                                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">
                                No activity in this workspace yet.
                            </div>
                        )}
                    </div>
                     {notifications.length > 0 && hasMore && (
                        <div className="p-4 flex justify-center">
                            <Button onClick={() => fetchNotifications(true)} variant="outline" disabled={isLoading}>
                                {isLoading ? 'Loading...' : 'Load More'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
