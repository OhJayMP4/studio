'use client';
import { collection, doc, addDoc, writeBatch, getDoc, Firestore, DocumentData } from "firebase/firestore";
import type { Company, Project, Silo, Task, Workspace } from "./types";

interface AddTaskParams {
    workspaceId: string;
    companyId: string;
    projectId: string;
    siloId: string;
    taskData: Omit<Task, 'id' | 'description'> & { description?: string };
}

export async function addTask(firestore: Firestore, params: AddTaskParams) {
    const { workspaceId, companyId, projectId, siloId, taskData } = params;

    const workspaceRef = doc(firestore, 'workspaces', workspaceId);
    const companyRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}`);
    const projectRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`);
    const siloRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`);
    const taskRef = doc(collection(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks`));
    
    const batch = writeBatch(firestore);

    // 1. Get all documents needed for denormalization
    const [workspaceSnap, companySnap, projectSnap, siloSnap] = await Promise.all([
        getDoc(workspaceRef),
        getDoc(companyRef),
        getDoc(projectRef),
        getDoc(siloRef),
    ]);

    if (!workspaceSnap.exists()) throw new Error("Workspace not found!");
    if (!companySnap.exists()) throw new Error("Company not found!");
    if (!projectSnap.exists()) throw new Error("Project not found!");
    if (!siloSnap.exists()) throw new Error("Silo not found!");

    const workspaceData = workspaceSnap.data() as Workspace;
    const companyData = companySnap.data() as Company;
    const projectData = projectSnap.data() as Project;
    const siloData = siloSnap.data() as Silo;
    
    // 2. Create the original task
    batch.set(taskRef, {...taskData, projectId});

    // 3. SECURITY CHECK: Verify assignee is a member of the workspace before denormalizing
    if (workspaceData.users && workspaceData.users[taskData.assigneeId]) {
        const userTaskRef = doc(collection(firestore, `user-tasks/${taskData.assigneeId}/tasks`));
        
        batch.set(userTaskRef, {
            originalTaskId: taskRef.id,
            workspaceId,
            companyId,
            projectId,
            siloId,
            title: taskData.title,
            description: taskData.description || '',
            completed: taskData.completed,
            dueDate: taskData.dueDate,
            priority: taskData.priority,
            assigneeId: taskData.assigneeId,
            companyName: companyData.name,
            projectName: projectData.name,
            siloName: siloData.name,
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
        batch.update(document.ref, { "completed": completed });
    });

    await batch.commit();
}
