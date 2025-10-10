
'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { UserTask } from "@/lib/types";

export function useUserTasks() {
    const { user } = useUser();
    const firestore = useFirestore();
    
    const tasksQuery = useMemoFirebase(() => {
        if (!user?.uid) return null;
        return query(
            collection(firestore, `user-tasks/${user.uid}/tasks`)
        );
    }, [firestore, user?.uid]);

    const { data, isLoading, error } = useCollection<UserTask>(tasksQuery);
    
    const tasks = useMemo(() => {
        if (!data) return { active: [], completed: [] };

        const active = data
            .filter(t => !t.task.completed)
            .sort((a, b) => new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime());
        
        const completed = data
            .filter(t => t.task.completed)
            .sort((a, b) => new Date(b.task.dueDate).getTime() - new Date(a.task.dueDate).getTime());

        return { active, completed };
    }, [data]);

    return { tasks, isLoading, error: error?.message || null };
}
