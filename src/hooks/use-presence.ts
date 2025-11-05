'use client';

import { useEffect, useState } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, serverTimestamp, setDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore';
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

    const workspaceId = selectedWorkspace?.id;
    const userId = user?.uid;

    // --- Write user's own presence ---
    useEffect(() => {
        if (!workspaceId || !userId || !user?.displayName || !firestore) return;

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
            }, { merge: true }).catch(err => console.error("Presence update failed:", err));
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
    
    
    // --- Read presence data for the workspace ---
    const [activeUsers, setActiveUsers] = useState<Presence[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!workspaceId || !firestore) {
            setActiveUsers(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        
        const q = query(
            collection(firestore, `presence/${workspaceId}/users`)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = Date.now();
            const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Presence));
            
            const currentlyActiveUsers = allUsers.filter(presenceUser => {
                if (presenceUser.lastSeen) {
                    const lastSeenMillis = (presenceUser.lastSeen as Timestamp).toMillis();
                    return (now - lastSeenMillis) < ACTIVE_THRESHOLD;
                }
                return false;
            });
            
            setActiveUsers(currentlyActiveUsers);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching presence:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [workspaceId, firestore]);


    return { activeUsers, isLoading, currentUser: user };
};
