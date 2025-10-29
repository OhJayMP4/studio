
'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { UserTask } from "@/lib/types";

export function useUserTasks(workspaceId?: string | null) {
    const { user } = useUser();
    const firestore = useFirestore();
    
    const tasksQuery = useMemoFirebase(() => {
        if (!user?.uid) return null;
        
        const tasksCollection = collection(firestore, `user-tasks/${user.uid}/tasks`);

        // If a workspaceId is provided, filter by it.
        if (workspaceId) {
            return query(
                tasksCollection,
                where("workspaceId", "==", workspaceId)
            );
        }
        
        // Otherwise, return null to prevent fetching all tasks across all workspaces
        return null; 
    }, [firestore, user?.uid, workspaceId]);

    const { data, isLoading, error } = useCollection<UserTask>(tasksQuery);
    
    const tasks = useMemo(() => {
        // If there's no data (or no query because workspaceId is missing), return empty arrays.
        if (!data) return { active: [], completed: [] };

        const active = data
            .filter(t => !t.completed)
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        
        const completed = data
            .filter(t => t.completed)
            .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

        return { active, completed };
    }, [data]);

    return { tasks, isLoading, error: error?.message || null };
}
