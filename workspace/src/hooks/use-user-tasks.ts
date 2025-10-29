
'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { UserTask } from "@/lib/types";

export function useUserTasks(workspaceId?: string | null) {
    const { user } = useUser();
    const firestore = useFirestore();
    
    const tasksQuery = useMemoFirebase(() => {
        if (!user?.uid || !workspaceId) return null;
        // Query the user's tasks collection...
        const tasksCollection = collection(firestore, `user-tasks/${user.uid}/tasks`);
        // ...and filter by the currently selected workspaceId.
        return query(
            tasksCollection,
            where("workspaceId", "==", workspaceId)
        );
    }, [firestore, user?.uid, workspaceId]);

    const { data, isLoading, error } = useCollection<UserTask>(tasksQuery);
    
    const tasks = useMemo(() => {
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
