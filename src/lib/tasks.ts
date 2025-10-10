'use client';
import { collection, doc, addDoc, writeBatch, getDoc, Firestore, DocumentData } from "firebase/firestore";
import type { Task } from "./types";

interface AddTaskParams {
    workspaceId: string;
    companyId: string;
    projectId: string;
    siloId: string;
    taskData: Omit<Task, 'id'>;
}

export async function addTask(firestore: Firestore, params: AddTaskParams) {
    const { workspaceId, companyId, projectId, siloId, taskData } = params;

    const taskRef = doc(collection(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks`));
    const userTaskRef = doc(collection(firestore, `user-tasks/${taskData.assigneeId}/tasks`));
    const projectRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`);
    
    const batch = writeBatch(firestore);

    // Get the project document to denormalize it
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
        throw new Error("Project not found to denormalize task!");
    }
    const projectData = projectSnap.data();

    // 1. Create the original task
    batch.set(taskRef, taskData);

    // 2. Create the denormalized user task
    batch.set(userTaskRef, {
        originalTaskId: taskRef.id,
        workspaceId,
        companyId,
        projectId,
        siloId,
        task: taskData,
        project: projectData,
    });

    await batch.commit();
}


export async function updateTaskCompletion(firestore: Firestore, originalTaskPath: string, userId: string, originalTaskId: string, completed: boolean) {
    const originalTaskRef = doc(firestore, originalTaskPath);
    
    // Find the denormalized task to update. We need to query for it.
    const userTasksRef = collection(firestore, `user-tasks/${userId}/tasks`);
    const { query, where, getDocs } = await import('firebase/firestore');
    const q = query(userTasksRef, where("originalTaskId", "==", originalTaskId));
    const querySnapshot = await getDocs(q);

    const batch = writeBatch(firestore);

    // Update original task
    batch.update(originalTaskRef, { completed });

    // Update denormalized task(s) - should only be one
    querySnapshot.forEach(document => {
        batch.update(document.ref, { "task.completed": completed });
    });

    await batch.commit();
}

    