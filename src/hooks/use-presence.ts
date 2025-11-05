'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, serverTimestamp, setDoc, doc, Timestamp } from 'firebase/firestore';
import type { Presence, UserProfile } from '@/lib/types';

const PRESENCE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const ACTIVE_THRESHOLD = 60000; // 1 minute

// Helper to get a random color
const getRandomColor = () => PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)];

// Main hook to manage presence
export const usePresence = () => {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user } = useUser();
    const firestore = useFirestore();
    const [userColor] = useState(() => getRandomColor());

    const workspaceId = selectedWorkspace?.id;
    const userId = user?.uid;

    // --- Write user's own presence ---
    useEffect(() => {
        if (!workspaceId || !userId || !user?.displayName) return;

        const presenceRef = doc(firestore, `presence/${workspaceId}/${userId}`);
        let heartbeatInterval: NodeJS.Timeout | null = null;

        const updatePresence = () => {
            setDoc(presenceRef, {
                lastSeen: serverTimestamp(),
                color: userColor,
                user: {
                    name: user.displayName,
                    avatarUrl: user.photoURL || null,
                }
            });
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

        // Initial update and start heartbeat
        updatePresence();
        heartbeatInterval = setInterval(updatePresence, HEARTBEAT_INTERVAL);

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
            // Optional: You could add a function here to set the user offline in Firestore
            // For simplicity, we rely on the `lastSeen` timestamp becoming old.
        };
    }, [workspaceId, userId, userColor, firestore, user?.displayName, user?.photoURL]);


    // --- Read presence data for the workspace ---
    const activeUsersQuery = useMemoFirebase(() => {
        if (!workspaceId) return null;
        
        const oneMinuteAgo = Timestamp.fromMillis(Date.now() - ACTIVE_THRESHOLD);
        
        return query(
            collection(firestore, `presence/${workspaceId}`),
            where('lastSeen', '>', oneMinuteAgo)
        );
    }, [firestore, workspaceId]);

    const { data: activeUsers, isLoading } = useCollection<Presence>(activeUsersQuery, {
      // This is a short-lived query, so we don't need to listen for long.
      // Re-querying every few seconds would also be an option instead of a persistent listener.
    });

    return { activeUsers, isLoading, currentUser: user };
};
