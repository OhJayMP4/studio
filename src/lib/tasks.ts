
'use client';
import { collection, doc, writeBatch, getDoc, setDoc, Firestore, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import type { Company, Project, Silo, Task, Workspace } from "./types";

interface AddTaskParams {
    workspaceId: string;
    companyId: string;
    projectId: string;
    siloId: string;
    taskData: Omit<Task, 'id' | 'description' | 'workspaceId' | 'projectId'> & { description?: string, createdBy: string };
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
    
    // Use "Quick Tasks" for the display name if it's the internal reserved project
    const projectName = projectId === 'general-tasks' ? 'Quick Tasks' : projectData.name;

    // 2. Create the original task
    batch.set(taskRef, {
        ...taskData, 
        projectId, 
        workspaceId, 
        timeSpentMinutes: 0,
        createdAt: serverTimestamp()
    });

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
            createdBy: taskData.createdBy,
            companyName: companyData.name,
            projectName: projectName,
            siloName: siloData.name,
            timeSpentMinutes: 0,
            createdAt: serverTimestamp()
        });
    } else {
        console.warn(`Skipping task denormalization: User ${taskData.assigneeId} is not a member of workspace ${workspaceId}.`);
    }

    await batch.commit();
}

/**
 * Updates a task and ensures all denormalized copies stay in sync.
 */
export async function updateTask(
    firestore: Firestore,
    originalTaskPath: string,
    originalTaskId: string,
    updates: Partial<Task>,
    oldAssigneeId: string
) {
    const originalTaskRef = doc(firestore, originalTaskPath);
    const batch = writeBatch(firestore);

    // 1. Update the original task
    batch.update(originalTaskRef, updates);

    // 2. Sync with denormalized user-tasks
    const isAssigneeChanged = updates.assigneeId && updates.assigneeId !== oldAssigneeId;
    
    // Find existing denormalized record for the old assignee
    const oldUserTasksQuery = query(
        collection(firestore, `user-tasks/${oldAssigneeId}/tasks`),
        where("originalTaskId", "==", originalTaskId)
    );
    const oldUserTasksSnap = await getDocs(oldUserTasksQuery);

    if (isAssigneeChanged) {
        // Delete from old user's list
        oldUserTasksSnap.forEach(d => batch.delete(d.ref));

        // Create in new user's list
        const newUserTaskRef = doc(collection(firestore, `user-tasks/${updates.assigneeId}/tasks`));
        
        // We need the full context for the new record
        const originalSnap = await getDoc(originalTaskRef);
        const taskData = originalSnap.data() as Task;
        
        const projectId = originalTaskPath.split('/')[5];
        const isQuickTask = projectId === 'general-tasks';

        // Since we are in a batch and haven't committed the original update yet, 
        // we manually merge the new updates for the denormalized copy
        const denormalizedData = {
            originalTaskId,
            workspaceId: taskData.workspaceId,
            companyId: originalTaskPath.split('/')[3],
            projectId: taskData.projectId,
            siloId: originalTaskPath.split('/')[7],
            title: updates.title ?? taskData.title,
            description: updates.description ?? taskData.description ?? '',
            completed: updates.completed ?? taskData.completed,
            dueDate: updates.dueDate ?? taskData.dueDate,
            priority: updates.priority ?? taskData.priority,
            assigneeId: updates.assigneeId,
            createdBy: taskData.createdBy,
            companyName: (oldUserTasksSnap.docs[0]?.data() as any)?.companyName || 'Company',
            projectName: isQuickTask ? 'Quick Tasks' : ((oldUserTasksSnap.docs[0]?.data() as any)?.projectName || 'Project'),
            siloName: (oldUserTasksSnap.docs[0]?.data() as any)?.siloName || 'Silo',
            timeSpentMinutes: taskData.timeSpentMinutes ?? 0,
            createdAt: taskData.createdAt || null,
        };
        
        batch.set(newUserTaskRef, denormalizedData);
    } else {
        // Just update existing records for the same user
        oldUserTasksSnap.forEach(document => {
            batch.update(document.ref, updates);
        });
    }

    await batch.commit();
}

/**
 * Adds a task to a "Quick Tasks" container for a company, creating the container if it doesn't exist.
 * This satisfies the need for quick tasks without forcing users to navigate silos.
 */
export async function addQuickTask(firestore: Firestore, params: {
    workspaceId: string;
    companyId: string;
    taskData: Omit<Task, 'id' | 'description' | 'workspaceId' | 'projectId'> & { description?: string, createdBy: string };
}) {
    const { workspaceId, companyId, taskData } = params;
    
    // We use a reserved ID for the quick tasks project and silo to make lookup instant and consistent
    const projectId = 'general-tasks';
    const siloId = 'inbox';

    const projectRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`);
    const siloRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`);

    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
        await setDoc(projectRef, {
            name: 'Quick Tasks',
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
    } else if (projectSnap.data().name !== 'Quick Tasks') {
        // Self-healing: Update name if it's still 'General Tasks'
        await updateDoc(projectRef, { name: 'Quick Tasks' });
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
