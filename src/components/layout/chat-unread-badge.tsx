
'use client';

import React, { useMemo } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';
import { useUserPrefs } from '@/hooks/use-sidebar-prefs';
import { SidebarMenuBadge } from '../ui/sidebar';

export function ChatUnreadBadge() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const { prefs } = useUserPrefs();
  const firestore = useFirestore();

  // Fetch recent messages
  const messagesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return query(
      collection(firestore, `workspaces/${selectedWorkspace.id}/chatMessages`),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, selectedWorkspace]);

  const { data: messages } = useCollection<ChatMessage>(messagesQuery);

  const unreadCount = useMemo(() => {
    if (!messages || !prefs) return 0;
    
    const lastReadAt = prefs.viewPrefs?.chatLastReadAt;
    if (!lastReadAt) return messages.length;

    const lastReadMillis = (lastReadAt as any).seconds 
        ? (lastReadAt as any).seconds * 1000 
        : new Date(lastReadAt as any).getTime();

    return messages.filter(msg => {
        if (!msg.createdAt) return false;
        const msgMillis = (msg.createdAt as Timestamp).toMillis();
        return msgMillis > lastReadMillis;
    }).length;
  }, [messages, prefs]);

  if (unreadCount === 0) return null;

  return (
    <SidebarMenuBadge className="bg-primary text-primary-foreground font-bold tabular-nums">
      {unreadCount > 9 ? '9+' : unreadCount}
    </SidebarMenuBadge>
  );
}
