
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
        if (!data) return { active: [], inProgress: [], awaitingApproval: [], completed: [] };

        const byDueAsc = (a: UserTask, b: UserTask) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

        const effectiveStatus = (t: UserTask) =>
            t.status || (t.completed ? 'completed' : 'todo');

        const active = data
            .filter(t => !t.completed && effectiveStatus(t) !== 'completed')
            .sort(byDueAsc);

        const inProgress = active.filter(t => effectiveStatus(t) === 'in_progress');

        const awaitingApproval = active.filter(t => effectiveStatus(t) === 'awaiting_approval');

        const completed = data
            .filter(t => t.completed || effectiveStatus(t) === 'completed')
            .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

        return { active, inProgress, awaitingApproval, completed };
    }, [data]);

    return { tasks, isLoading, error: error?.message || null };
}
