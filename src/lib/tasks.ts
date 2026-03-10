
'use client';
import { collection, doc, writeBatch, getDoc, setDoc, Firestore } from "firebase/firestore";
import type { Company, Project, Silo, Task, Workspace } from "./types";

interface AddTaskParams {
    workspaceId: string;
    companyId: string;
    projectId: string;
    siloId: string;
    taskData: Omit<Task, 'id' | 'description' | 'workspaceId'> & { description?: string, createdBy: string };
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
    batch.set(taskRef, {...taskData, projectId, workspaceId, timeSpentMinutes: 0});

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
            timeSpentMinutes: 0,
        });
    } else {
        console.warn(`Skipping task denormalization: User ${taskData.assigneeId} is not a member of workspace ${workspaceId}.`);
    }

    await batch.commit();
}

/**
 * Adds a task to a "General Tasks" container for a company, creating the container if it doesn't exist.
 * This satisfies the need for quick tasks without forcing users to navigate silos.
 */
export async function addQuickTask(firestore: Firestore, params: {
    workspaceId: string;
    companyId: string;
    taskData: Omit<Task, 'id' | 'description' | 'workspaceId' | 'projectId'> & { description?: string, createdBy: string };
}) {
    const { workspaceId, companyId, taskData } = params;
    
    // We use a reserved ID for the general project and silo to make lookup instant and consistent
    const projectId = 'general-tasks';
    const siloId = 'inbox';

    const projectRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`);
    const siloRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`);

    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
        await setDoc(projectRef, {
            name: 'General Tasks',
            deadline: new Date(2099, 11, 31).toISOString(), // Far future
            hasMonetaryValue: false,
            progress: 0,
            companyId,
            workspaceId,
            totalSalesValue: 0,
            createdBy: taskData.createdBy,
            status: 'active',
            completedAt: null,
        });
    }

    const siloSnap = await getDoc(siloRef);
    if (!siloSnap.exists()) {
        await setDoc(siloRef, {
            name: 'Inbox',
            order: 0,
            createdBy: taskData.createdBy,
            workspaceId
        });
    }

    return addTask(firestore, {
        workspaceId,
        companyId,
        projectId,
        siloId,
        taskData: {
            ...taskData,
            projectId // addTask expects this in the data object too
        }
    });
}


export async function updateTaskCompletion(
    firestore: Firestore, 
    originalTaskPath: string, 
    userId: string, 
    originalTaskId: string, 
    completed: boolean,
    timeSpentMinutes?: number
) {
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

    // Update original task, and add an 'updatedBy' field
    const auth = (await import('firebase/auth')).getAuth();
    const currentUser = auth.currentUser;
    
    const updateData: any = { completed, updatedBy: currentUser?.uid };
    if (completed) {
        updateData.timeSpentMinutes = timeSpentMinutes || 0;
    }

    batch.update(originalTaskRef, updateData);

    // Update denormalized task(s) - should only be one
    userTasksSnap.forEach(document => {
        const userTaskUpdate: any = { "completed": completed };
        if (completed) {
            userTaskUpdate.timeSpentMinutes = timeSpentMinutes || 0;
        }
        batch.update(document.ref, userTaskUpdate);
    });

    await batch.commit();
}
