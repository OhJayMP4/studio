'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, serverTimestamp, setDoc, doc, Timestamp } from 'firebase/firestore';
import type { Presence } from '@/lib/types';

const PRESENCE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const ACTIVE_THRESHOLD = 60000; // 1 minute

const getRandomColor = () => PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)];

export const usePresence = () => {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user } = useUser();
    const firestore = useFirestore();
    const [userColor] = useState(() => getRandomColor());
    const [activeThresholdTimestamp, setActiveThresholdTimestamp] = useState(() => Timestamp.fromMillis(Date.now() - ACTIVE_THRESHOLD));

    const workspaceId = selectedWorkspace?.id;
    const userId = user?.uid;

    // --- Write user's own presence ---
    useEffect(() => {
        if (!workspaceId || !userId || !user?.displayName) return;

        const presenceRef = doc(firestore, `presence/${workspaceId}/users/${userId}`);
        let heartbeatInterval: NodeJS.Timeout | null = null;

        const updatePresence = () => {
            setDoc(presenceRef, {
                lastSeen: serverTimestamp(),
                color: userColor,
                user: {
                    name: user.displayName,
                    avatarUrl: user.photoURL || null,
                }
            }, { merge: true });
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updatePresence();
                if (!heartbeatInterval) {
                    heartbeatInterval = setInterval(updatePresence, HEARTBEAT_INTERVAL);
                }
            } else {
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                    heartbeatInterval = null;
                }
            }
        };

        updatePresence();
        heartbeatInterval = setInterval(updatePresence, HEARTBEAT_INTERVAL);

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
        };
    }, [workspaceId, userId, userColor, firestore, user?.displayName, user?.photoURL]);
    
     // --- Periodically update the active threshold for the query ---
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveThresholdTimestamp(Timestamp.fromMillis(Date.now() - ACTIVE_THRESHOLD));
        }, HEARTBEAT_INTERVAL); // Update threshold at the same rate as heartbeat

        return () => clearInterval(interval);
    }, []);

    // --- Read presence data for the workspace ---
    const activeUsersQuery = useMemoFirebase(() => {
        if (!workspaceId) return null;
        
        return query(
            collection(firestore, `presence/${workspaceId}/users`),
            where('lastSeen', '>', activeThresholdTimestamp)
        );
    }, [firestore, workspaceId, activeThresholdTimestamp]);

    const { data: activeUsers, isLoading } = useCollection<Presence>(activeUsersQuery);

    return { activeUsers, isLoading, currentUser: user };
};
