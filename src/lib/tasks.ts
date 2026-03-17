
'use client';
import { collection, doc, writeBatch, getDoc, setDoc, Firestore, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import type { Company, Project, Silo, Task, Workspace } from "./types";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

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
    
    const projectName = projectId === 'general-tasks' ? 'Quick Tasks' : projectData.name;

    const originalTaskData = {
        ...taskData, 
        projectId, 
        workspaceId, 
        timeSpentMinutes: 0,
        createdAt: serverTimestamp()
    };

    // 2. Create the original task
    batch.set(taskRef, originalTaskData);

    // 3. Denormalize
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
    }

    // Commit non-blocking
    batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: taskRef.path,
            operation: 'create',
            requestResourceData: originalTaskData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
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
    
    const oldUserTasksQuery = query(
        collection(firestore, `user-tasks/${oldAssigneeId}/tasks`),
        where("originalTaskId", "==", originalTaskId)
    );
    const oldUserTasksSnap = await getDocs(oldUserTasksQuery);

    if (isAssigneeChanged) {
        oldUserTasksSnap.forEach(d => batch.delete(d.ref));

        const newUserTaskRef = doc(collection(firestore, `user-tasks/${updates.assigneeId}/tasks`));
        const originalSnap = await getDoc(originalTaskRef);
        const taskData = originalSnap.data() as Task;
        
        const projectId = originalTaskPath.split('/')[5];
        const isQuickTask = projectId === 'general-tasks';

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
        oldUserTasksSnap.forEach(document => {
            batch.update(document.ref, updates);
        });
    }

    // Commit non-blocking
    batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: originalTaskRef.path,
            operation: 'update',
            requestResourceData: updates,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Deletes a task and ensures all denormalized copies are removed.
 */
export async function deleteTask(
    firestore: Firestore,
    originalTaskPath: string,
    originalTaskId: string,
    assigneeId: string
) {
    const originalTaskRef = doc(firestore, originalTaskPath);
    const batch = writeBatch(firestore);

    // 1. Delete original task
    batch.delete(originalTaskRef);

    // 2. Delete denormalized task(s)
    const userTasksRef = collection(firestore, `user-tasks/${assigneeId}/tasks`);
    const q = query(userTasksRef, where("originalTaskId", "==", originalTaskId));
    const userTasksSnap = await getDocs(q);
    
    userTasksSnap.forEach(d => batch.delete(d.ref));

    // Commit non-blocking
    batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: originalTaskRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Adds a task to a "Quick Tasks" container for a company.
 */
export async function addQuickTask(firestore: Firestore, params: {
    workspaceId: string;
    companyId: string;
    taskData: Omit<Task, 'id' | 'description' | 'workspaceId' | 'projectId'> & { description?: string, createdBy: string };
}) {
    const { workspaceId, companyId, taskData } = params;
    const projectId = 'general-tasks';
    const siloId = 'inbox';

    const projectRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`);
    const siloRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`);

    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
        await setDoc(projectRef, {
            name: 'Quick Tasks',
            deadline: new Date(2099, 11, 31).toISOString(),
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

    // Don't await the final add, let it happen in background
    return addTask(firestore, {
        workspaceId,
        companyId,
        projectId,
        siloId,
        taskData: { ...taskData, projectId }
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
    const userTasksRef = collection(firestore, `user-tasks/${userId}/tasks`);
    const q = query(userTasksRef, where("originalTaskId", "==", originalTaskId));
    
    const [originalTaskSnap, userTasksSnap] = await Promise.all([
        getDoc(originalTaskRef),
        getDocs(q)
    ]);

    if (!originalTaskSnap.exists()) throw new Error("Original task not found.");
    
    if (originalTaskSnap.data().assigneeId !== userId) {
        console.error(`Security violation: User ${userId} attempted to update a task not assigned to them.`);
        return;
    }

    const batch = writeBatch(firestore);
    const updateData: any = { completed };
    if (completed) {
        updateData.timeSpentMinutes = timeSpentMinutes || 0;
    }

    batch.update(originalTaskRef, updateData);
    userTasksSnap.forEach(document => {
        batch.update(document.ref, { "completed": completed, timeSpentMinutes: timeSpentMinutes || 0 });
    });

    batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: originalTaskRef.path,
            operation: 'update',
            requestResourceData: updateData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Duplicates a project, its silos, and its tasks to a target company.
 * Reassigns all tasks to a specified user.
 */
export async function duplicateProject(
    firestore: Firestore,
    params: {
        workspaceId: string;
        sourceCompanyId: string;
        sourceProjectId: string;
        targetCompanyId: string;
        targetAssigneeId: string;
        currentUserId: string;
    }
) {
    const { workspaceId, sourceCompanyId, sourceProjectId, targetCompanyId, targetAssigneeId, currentUserId } = params;

    // 1. Get Source Data
    const sourceProjectRef = doc(firestore, `workspaces/${workspaceId}/companies/${sourceCompanyId}/projects/${sourceProjectId}`);
    const targetCompanyRef = doc(firestore, `workspaces/${workspaceId}/companies/${targetCompanyId}`);
    
    const [sourceProjectSnap, targetCompanySnap] = await Promise.all([
        getDoc(sourceProjectRef),
        getDoc(targetCompanyRef)
    ]);

    if (!sourceProjectSnap.exists()) throw new Error("Source project not found.");
    if (!targetCompanySnap.exists()) throw new Error("Target company not found.");

    const sourceProjectData = sourceProjectSnap.data() as Project;
    const targetCompanyData = targetCompanySnap.data() as Company;

    // 2. Create Target Project
    const targetProjectsCol = collection(firestore, `workspaces/${workspaceId}/companies/${targetCompanyId}/projects`);
    const targetProjectRef = doc(targetProjectsCol);
    const targetProjectData = {
        ...sourceProjectData,
        name: `${sourceProjectData.name} (Copy)`,
        companyId: targetCompanyId,
        createdBy: currentUserId,
        progress: 0,
        totalSalesValue: 0,
        status: 'active',
        completedAt: null,
        createdAt: serverTimestamp(),
    };

    const batch = writeBatch(firestore);
    batch.set(targetProjectRef, targetProjectData);

    // 3. Fetch and Duplicate Silos & Tasks
    const silosQuery = collection(sourceProjectRef, 'silos');
    const silosSnap = await getDocs(silosQuery);

    for (const siloDoc of silosSnap.docs) {
        const siloData = siloDoc.data() as Silo;
        const targetSiloRef = doc(collection(targetProjectRef, 'silos'));
        
        batch.set(targetSiloRef, {
            ...siloData,
            workspaceId,
            createdBy: currentUserId,
        });

        // Fetch tasks for this silo
        const tasksQuery = collection(siloDoc.ref, 'tasks');
        const tasksSnap = await getDocs(tasksQuery);

        for (const taskDoc of tasksSnap.docs) {
            const taskData = taskDoc.data() as Task;
            const targetTaskRef = doc(collection(targetSiloRef, 'tasks'));
            
            const newTaskData = {
                ...taskData,
                workspaceId,
                projectId: targetProjectRef.id,
                assigneeId: targetAssigneeId,
                completed: false,
                timeSpentMinutes: 0,
                createdBy: currentUserId,
                createdAt: serverTimestamp(),
            };

            batch.set(targetTaskRef, newTaskData);

            // Denormalize for the new assignee
            const userTaskRef = doc(collection(firestore, `user-tasks/${targetAssigneeId}/tasks`));
            batch.set(userTaskRef, {
                originalTaskId: targetTaskRef.id,
                workspaceId,
                companyId: targetCompanyId,
                projectId: targetProjectRef.id,
                siloId: targetSiloRef.id,
                title: taskData.title,
                description: taskData.description || '',
                completed: false,
                dueDate: taskData.dueDate,
                priority: taskData.priority,
                assigneeId: targetAssigneeId,
                createdBy: currentUserId,
                companyName: targetCompanyData.name,
                projectName: targetProjectData.name,
                siloName: siloData.name,
                timeSpentMinutes: 0,
                createdAt: serverTimestamp()
            });
        }
    }

    // 4. Commit everything
    return batch.commit();
}
