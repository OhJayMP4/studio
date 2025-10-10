'use client';
import { collection, doc, addDoc, writeBatch, getDoc, Firestore, DocumentData } from "firebase/firestore";
import type { Task, Workspace } from "./types";

interface AddTaskParams {
    workspaceId: string;
    companyId: string;
    projectId: string;
    siloId: string;
    taskData: Omit<Task, 'id'>;
}

export async function addTask(firestore: Firestore, params: AddTaskParams) {
    const { workspaceId, companyId, projectId, siloId, taskData } = params;

    const workspaceRef = doc(firestore, 'workspaces', workspaceId);
    const projectRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`);
    const taskRef = doc(collection(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks`));
    
    const batch = writeBatch(firestore);

    // 1. Get workspace and project documents
    const [workspaceSnap, projectSnap] = await Promise.all([
        getDoc(workspaceRef),
        getDoc(projectRef)
    ]);

    if (!workspaceSnap.exists()) {
        throw new Error("Workspace not found!");
    }
    if (!projectSnap.exists()) {
        throw new Error("Project not found to denormalize task!");
    }

    const workspaceData = workspaceSnap.data() as Workspace;
    const projectData = projectSnap.data();
    
    // 2. Create the original task
    batch.set(taskRef, taskData);

    // 3. SECURITY CHECK: Verify assignee is a member of the workspace before denormalizing
    if (workspaceData.users && workspaceData.users[taskData.assigneeId]) {
        const userTaskRef = doc(collection(firestore, `user-tasks/${taskData.assigneeId}/tasks`));
        // Create the denormalized user task
        batch.set(userTaskRef, {
            originalTaskId: taskRef.id,
            workspaceId,
            companyId,
            projectId,
            siloId,
            task: taskData,
            project: projectData,
        });
    } else {
        console.warn(`Skipping task denormalization: User ${taskData.assigneeId} is not a member of workspace ${workspaceId}.`);
    }


    await batch.commit();
}


export async function updateTaskCompletion(firestore: Firestore, originalTaskPath: string, userId: string, originalTaskId: string, completed: boolean) {
    const originalTaskRef = doc(firestore, originalTaskPath);
    
    // Find the denormalized task to update. We need to query for it.
    const { query, where, getDocs } = await import('firebase/firestore');
    const userTasksRef = collection(firestore, `user-tasks/${userId}/tasks`);
    const q = query(userTasksRef, where("originalTaskId", "==", originalTaskId));
    
    const [originalTaskSnap, userTasksSnap] = await Promise.all([
        getDoc(originalTaskRef),
        getDocs(q)
    ]);

    if (!originalTaskSnap.exists()) {
        throw new Error("Original task not found.");
    }
    
    // Security check: ensure the user ID matches the assignee on the original task.
    if (originalTaskSnap.data().assigneeId !== userId) {
        console.error(`Security violation: User ${userId} attempted to update a task not assigned to them.`);
        return;
    }

    const batch = writeBatch(firestore);

    // Update original task
    batch.update(originalTaskRef, { completed });

    // Update denormalized task(s) - should only be one
    userTasksSnap.forEach(document => {
        batch.update(document.ref, { "task.completed": completed });
    });

    await batch.commit();
}
