"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const resend_1 = require("resend");
const defaultSidebarModules = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', route: '/dashboard', hidden: false, order: 0 },
    { id: 'companies', label: 'Companies', icon: 'Building', route: '/companies', hidden: false, order: 1 },
    { id: 'reporting', label: 'Reporting', icon: 'BarChart', route: '/reporting', hidden: false, order: 2 },
    { id: 'my-tasks', label: 'My Tasks', icon: 'ClipboardCheck', route: '/my-tasks', hidden: false, order: 3 },
];
admin.initializeApp();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const updateProjectProgress = async (workspaceId, companyId, projectId) => {
    const projectRef = db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`);
    try {
        const [projectSnap, silosSnap] = await Promise.all([
            projectRef.get(),
            projectRef.collection('silos').get()
        ]);
        if (!projectSnap.exists)
            return;
        const projectData = projectSnap.data();
        let totalTasks = 0;
        let completedTasks = 0;
        const taskPromises = silosSnap.docs.map(silo => silo.ref.collection('tasks').get());
        const taskSnapshots = await Promise.all(taskPromises);
        taskSnapshots.forEach(snap => {
            snap.forEach(taskDoc => {
                totalTasks++;
                if (taskDoc.data().completed)
                    completedTasks++;
            });
        });
        const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
        const salesTarget = (projectData === null || projectData === void 0 ? void 0 : projectData.monetaryValue) || 0;
        const currentSales = (projectData === null || projectData === void 0 ? void 0 : projectData.totalSalesValue) || 0;
        const salesProgress = salesTarget > 0 ? Math.min(currentSales / salesTarget, 1) : 0;
        const newOverallProgress = Math.round((projectData === null || projectData === void 0 ? void 0 : projectData.hasMonetaryValue)
            ? (salesProgress * 0.5 + taskProgress * 0.5) * 100
            : taskProgress * 100);
        await projectRef.update({
            progress: newOverallProgress,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Updated project ${projectId} progress to ${newOverallProgress}%`);
    }
    catch (error) {
        console.error(`Failed to update progress for project ${projectId}:`, error);
    }
};
const getActorAndRelevantUsers = async (workspaceId, actorUid) => {
    var _a;
    const workspaceSnap = await db.doc(`workspaces/${workspaceId}`).get();
    if (!workspaceSnap.exists) {
        console.error(`Workspace ${workspaceId} not found.`);
        return { actorName: null, isRelevantTo: [] };
    }
    const workspaceData = workspaceSnap.data();
    const actor = (_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) === null || _a === void 0 ? void 0 : _a[actorUid];
    const actorName = (actor === null || actor === void 0 ? void 0 : actor.name) || (actor === null || actor === void 0 ? void 0 : actor.email) || 'A user';
    // Everyone in the workspace is relevant, including the actor
    const isRelevantTo = Object.keys((workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) || {});
    return { actorName, isRelevantTo };
};
const createNotification = async (workspaceId, notificationData) => {
    try {
        await db.collection(`notifications/${workspaceId}/activities`).add(Object.assign(Object.assign({}, notificationData), { timestamp: admin.firestore.FieldValue.serverTimestamp(), readBy: [] }));
    }
    catch (error) {
        console.error(`Failed to create notification for workspace ${workspaceId}:`, error);
    }
};
const sendTaskAssignmentEmail = async (params) => {
    var _a, _b;
    const resendApiKey = process.env.RESEND_API_KEY || ((_b = (_a = functions.config()) === null || _a === void 0 ? void 0 : _a.resend) === null || _b === void 0 ? void 0 : _b.key) || "re_hfnUftgP_LxQrEY7o8aEKeHUumQfM1Zqw";
    if (!resendApiKey) {
        console.error("CRITICAL: RESEND_API_KEY not found. Emails will not be sent.");
        return;
    }
    const resend = new resend_1.Resend(resendApiKey);
    const { to, userName, taskTitle, companyName, projectName } = params;
    console.log(`Attempting to send assignment email to: ${to}`);
    try {
        const { data, error } = await resend.emails.send({
            from: 'SaturnSync Notifications <notifications@saturnsync.com>',
            to: to,
            subject: `Task Assigned: ${taskTitle}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #FF6812;">Hello ${userName},</h2>
                    <p style="font-size: 16px; color: #333;">You have been assigned a new task in <strong>SaturnSync</strong>.</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Task:</strong> ${taskTitle}</p>
                        <p style="margin: 5px 0;"><strong>Company:</strong> ${companyName}</p>
                        <p style="margin: 5px 0;"><strong>Project:</strong> ${projectName}</p>
                    </div>

                    <p style="font-size: 14px; color: #666;">Log in to your dashboard to view full details.</p>
                    
                    <a href="https://saturnsync.com/my-tasks" style="display: inline-block; background-color: #FF6812; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">View My Tasks</a>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                    <p style="font-size: 12px; color: #999;">You received this because email notifications are enabled in your account settings.</p>
                </div>
            `,
        });
        if (error) {
            console.error("Resend API Error:", JSON.stringify(error));
        }
        else {
            console.log("Email sent successfully. ID:", data === null || data === void 0 ? void 0 : data.id);
        }
    }
    catch (error) {
        console.error("Failed to send task assignment email:", error);
    }
};
exports.onCommentCreate = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}/tasks/{taskId}/comments/{commentId}')
    .onCreate(async (snap, context) => {
    var _a, _b, _c;
    const { workspaceId, companyId, projectId, siloId, taskId } = context.params;
    const commentData = snap.data();
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, commentData.createdBy);
    if (!actorName)
        return;
    const [companySnap, projectSnap, taskSnap] = await Promise.all([
        db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
        db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
        db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${taskId}`).get()
    ]);
    const companyName = ((_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name) || '';
    const projectName = ((_b = projectSnap.data()) === null || _b === void 0 ? void 0 : _b.name) || '';
    const taskTitle = ((_c = taskSnap.data()) === null || _c === void 0 ? void 0 : _c.title) || '';
    await createNotification(workspaceId, {
        type: 'comment_added',
        actorUid: commentData.createdBy,
        actorName,
        target: { id: taskId, name: taskTitle, text: 'task', path: `/company/${companyId}/project/${projectId}` },
        context: {
            companyName,
            projectName,
            commentText: commentData.text,
        },
        isRelevantTo,
    });
});
exports.onCompanyCreate = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}')
    .onCreate(async (snap, context) => {
    const { workspaceId } = context.params;
    const companyData = snap.data();
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, companyData.createdBy);
    if (!actorName)
        return;
    await createNotification(workspaceId, {
        type: 'company_added',
        actorUid: companyData.createdBy,
        actorName,
        target: { id: snap.id, name: companyData.name, type: 'company', path: `/company/${snap.id}` },
        isRelevantTo,
    });
});
exports.onProjectCreate = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}')
    .onCreate(async (snap, context) => {
    var _a;
    const { workspaceId, companyId } = context.params;
    const projectData = snap.data();
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, projectData.createdBy);
    if (!actorName)
        return;
    const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
    const companyName = companySnap.exists ? (_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name : '';
    await createNotification(workspaceId, {
        type: 'project_added',
        actorUid: projectData.createdBy,
        actorName,
        target: { id: snap.id, name: projectData.name, type: 'project', path: `/company/${companyId}/project/${snap.id}` },
        context: { companyName },
        isRelevantTo,
    });
});
exports.onSiloCreate = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}')
    .onCreate(async (snap, context) => {
    var _a, _b;
    const { workspaceId, companyId, projectId } = context.params;
    const siloData = snap.data();
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, siloData.createdBy);
    if (!actorName)
        return;
    const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
    const projectSnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get();
    const companyName = companySnap.exists ? (_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name : '';
    const projectName = projectSnap.exists ? (_b = projectSnap.data()) === null || _b === void 0 ? void 0 : _b.name : '';
    await createNotification(workspaceId, {
        type: 'silo_added',
        actorUid: siloData.createdBy,
        actorName,
        target: { id: snap.id, name: siloData.name, type: 'silo', path: `/company/${companyId}/project/${projectId}` },
        context: { companyName, projectName },
        isRelevantTo,
    });
});
exports.onSiloDelete = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}')
    .onDelete(async (snap, context) => {
    var _a, _b;
    const { workspaceId, companyId, projectId } = context.params;
    const siloData = snap.data();
    const actorUid = siloData.updatedBy || siloData.createdBy;
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
    if (!actorName)
        return;
    const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
    const projectSnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get();
    const companyName = companySnap.exists ? (_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name : '';
    const projectName = projectSnap.exists ? (_b = projectSnap.data()) === null || _b === void 0 ? void 0 : _b.name : '';
    await createNotification(workspaceId, {
        type: 'silo_added',
        actorUid: siloData.createdBy,
        actorName,
        target: { id: snap.id, name: siloData.name, type: 'silo', path: `/company/${companyId}/project/${projectId}` },
        context: { companyName, projectName },
        isRelevantTo,
    });
});
exports.onSaleCreate = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/sales/{saleId}')
    .onCreate(async (snap, context) => {
    var _a, _b;
    const { workspaceId, companyId, projectId } = context.params;
    const saleData = snap.data();
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, saleData.createdBy);
    if (!actorName)
        return;
    const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
    const projectSnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get();
    const companyName = companySnap.exists ? (_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name : '';
    const projectName = projectSnap.exists ? (_b = projectSnap.data()) === null || _b === void 0 ? void 0 : _b.name : '';
    await createNotification(workspaceId, {
        type: 'sale_added',
        actorUid: saleData.createdBy,
        actorName,
        target: { id: snap.id, name: `Sale of R${saleData.value}`, type: 'sale', path: `/company/${companyId}/project/${projectId}` },
        context: { companyName, projectName },
        isRelevantTo,
    });
    await updateProjectProgress(workspaceId, companyId, projectId);
});
exports.onTaskWrite = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}/tasks/{taskId}')
    .onWrite(async (change, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const { workspaceId, companyId, projectId, siloId, taskId } = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    // 1. Handle Notifications & Emails
    if (afterData && (!beforeData || beforeData.assigneeId !== afterData.assigneeId)) {
        const actorUid = afterData.updatedBy || afterData.createdBy;
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
        if (!actorName)
            return;
        const [companySnap, projectSnap, siloSnap, assigneeSnap] = await Promise.all([
            db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get(),
            db.doc(`users/${afterData.assigneeId}`).get()
        ]);
        const companyName = ((_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name) || '';
        const projectName = ((_b = projectSnap.data()) === null || _b === void 0 ? void 0 : _b.name) || '';
        const siloName = ((_c = siloSnap.data()) === null || _c === void 0 ? void 0 : _c.name) || '';
        const assigneeName = assigneeSnap.exists ? (((_d = assigneeSnap.data()) === null || _d === void 0 ? void 0 : _d.name) || ((_e = assigneeSnap.data()) === null || _e === void 0 ? void 0 : _e.email)) : 'an unknown user';
        await createNotification(workspaceId, {
            type: 'task_assigned',
            actorUid,
            actorName,
            target: { id: change.after.id, name: afterData.title, type: 'task', path: `/company/${companyId}/project/${projectId}` },
            assignee: { uid: afterData.assigneeId, name: assigneeName },
            context: { companyName, projectName, siloName },
            isRelevantTo,
        });
        if (assigneeSnap.exists) {
            const assigneeData = assigneeSnap.data();
            const isEmailEnabled = (assigneeData === null || assigneeData === void 0 ? void 0 : assigneeData.emailNotificationsEnabled) !== false;
            const email = assigneeData === null || assigneeData === void 0 ? void 0 : assigneeData.email;
            if (isEmailEnabled && email) {
                await sendTaskAssignmentEmail({
                    to: email,
                    userName: (assigneeData === null || assigneeData === void 0 ? void 0 : assigneeData.name) || 'Team Member',
                    taskTitle: afterData.title,
                    companyName,
                    projectName
                });
            }
        }
    }
    if (beforeData && afterData && beforeData.completed === false && afterData.completed === true) {
        const actorUid = afterData.assigneeId;
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
        if (!actorName)
            return;
        const [companySnap, projectSnap, siloSnap] = await Promise.all([
            db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get()
        ]);
        const companyName = ((_f = companySnap.data()) === null || _f === void 0 ? void 0 : _f.name) || '';
        const projectName = ((_g = projectSnap.data()) === null || _g === void 0 ? void 0 : _g.name) || '';
        const siloName = ((_h = siloSnap.data()) === null || _h === void 0 ? void 0 : _h.name) || '';
        await createNotification(workspaceId, {
            type: 'task_completed',
            actorUid,
            actorName,
            target: { id: change.after.id, name: afterData.title, type: 'task', path: `/company/${companyId}/project/${projectId}` },
            context: { companyName, projectName, siloName },
            isRelevantTo,
        });
    }
    // 2. Synchronize Dashboard (UserTask)
    if (afterData && afterData.assigneeId) {
        const userTasksRef = db.collection(`user-tasks/${afterData.assigneeId}/tasks`);
        const existingQuery = await userTasksRef.where("originalTaskId", "==", taskId).get();
        const [companySnap, projectSnap, siloSnap] = await Promise.all([
            db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get()
        ]);
        const denormalizedData = {
            originalTaskId: taskId,
            workspaceId,
            companyId,
            projectId,
            siloId,
            title: afterData.title,
            description: afterData.description || '',
            completed: afterData.completed || false,
            completedAt: afterData.completed ? (afterData.completedAt || admin.firestore.FieldValue.serverTimestamp()) : null,
            dueDate: afterData.dueDate,
            priority: afterData.priority,
            assigneeId: afterData.assigneeId,
            createdBy: afterData.createdBy,
            companyName: ((_j = companySnap.data()) === null || _j === void 0 ? void 0 : _j.name) || 'Unknown Company',
            projectName: ((_k = projectSnap.data()) === null || _k === void 0 ? void 0 : _k.name) || 'Unknown Project',
            siloName: ((_l = siloSnap.data()) === null || _l === void 0 ? void 0 : _l.name) || 'Inbox',
            timeSpentMinutes: afterData.timeSpentMinutes || 0,
            createdAt: afterData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            type: 'denormalized'
        };
        if (existingQuery.empty) {
            await userTasksRef.add(denormalizedData);
        }
        else {
            await existingQuery.docs[0].ref.update(denormalizedData);
        }
    }
    await updateProjectProgress(workspaceId, companyId, projectId);
});
exports.onCompanyDelete = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}')
    .onDelete(async (snap, context) => {
    const { workspaceId } = context.params;
    const companyData = snap.data();
    const actorUid = companyData.updatedBy || companyData.createdBy;
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
    if (!actorName)
        return;
    await createNotification(workspaceId, {
        type: 'company_deleted',
        actorUid,
        actorName,
        target: { id: snap.id, name: companyData.name, type: 'company', path: `/companies` },
        isRelevantTo,
    });
});
exports.onProjectDelete = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}')
    .onDelete(async (snap, context) => {
    var _a;
    const { workspaceId, companyId } = context.params;
    const projectData = snap.data();
    const actorUid = projectData.updatedBy || projectData.createdBy;
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
    if (!actorName)
        return;
    const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
    const companyName = companySnap.exists ? (_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name : '';
    await createNotification(workspaceId, {
        type: 'project_deleted',
        actorUid,
        actorName,
        target: { id: snap.id, name: projectData.name, type: 'project', path: `/company/${companyId}` },
        context: { companyName },
        isRelevantTo,
    });
});
exports.onTaskDelete = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}/tasks/{taskId}')
    .onDelete(async (snap, context) => {
    var _a, _b, _c;
    const { taskId, workspaceId, companyId, projectId, siloId } = context.params;
    const taskData = snap.data();
    const actorUid = taskData.updatedBy || taskData.createdBy;
    const assigneeId = taskData.assigneeId;
    if (assigneeId) {
        console.log(`Cleaning up denormalized task ${taskId} for user ${assigneeId}`);
        const userTasksRef = db.collection(`user-tasks/${assigneeId}/tasks`);
        const q = userTasksRef.where("originalTaskId", "==", taskId);
        const userTasksSnap = await q.get();
        const batch = db.batch();
        userTasksSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
    if (!actorName)
        return;
    const [companySnap, projectSnap, siloSnap] = await Promise.all([
        db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
        db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
        db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get()
    ]);
    const companyName = ((_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name) || '';
    const projectName = ((_b = projectSnap.data()) === null || _b === void 0 ? void 0 : _b.name) || '';
    const siloName = ((_c = siloSnap.data()) === null || _c === void 0 ? void 0 : _c.name) || '';
    await createNotification(workspaceId, {
        type: 'task_deleted',
        actorUid,
        actorName,
        target: { id: snap.id, name: taskData.title, type: 'task', path: `/company/${companyId}/project/${projectId}` },
        context: { companyName, projectName, siloName },
        isRelevantTo,
    });
});
exports.onFileUpload = functions.firestore
    .document('workspace-files/{fileId}')
    .onCreate(async (snap, context) => {
    var _a;
    const fileData = snap.data();
    const { workspaceId, uploadedBy, fullPath } = fileData;
    const fileId = context.params.fileId;
    if (!workspaceId || !uploadedBy) {
        console.log(`File ${fileId} is missing workspaceId or uploadedBy, deleting.`);
        await snap.ref.delete();
        return;
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    try {
        const workspaceSnap = await workspaceRef.get();
        if (!workspaceSnap.exists) {
            throw new Error(`Workspace ${workspaceId} not found.`);
        }
        const workspaceData = workspaceSnap.data();
        const isMember = (_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.memberIds) === null || _a === void 0 ? void 0 : _a.includes(uploadedBy);
        if (!isMember) {
            throw new Error(`User ${uploadedBy} is not a member of workspace ${workspaceId}.`);
        }
        console.log(`File ${fileId} uploaded by valid member ${uploadedBy}.`);
    }
    catch (error) {
        console.error(`Unauthorized file upload detected. Deleting file and metadata. Error:`, error);
        const storage = admin.storage();
        const bucket = storage.bucket();
        const file = bucket.file(fullPath);
        await Promise.all([
            file.delete().catch(e => console.error(`Failed to delete file from storage: ${fullPath}`, e)),
            snap.ref.delete().catch(e => console.error(`Failed to delete firestore doc: ${snap.ref.path}`, e))
        ]);
        console.log(`Cleaned up unauthorized file ${fileId} at path ${fullPath}.`);
    }
});
const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
exports.createInvite = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to send invites.');
    }
    const uid = context.auth.uid;
    const { workspaceId, email } = data;
    if (!workspaceId || !email) {
        throw new functions.https.HttpsError('invalid-argument', 'Workspace ID and email are required.');
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceSnap = await workspaceRef.get();
    if (!workspaceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }
    const workspaceData = workspaceSnap.data();
    const userRole = (_b = (_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) === null || _a === void 0 ? void 0 : _a[uid]) === null || _b === void 0 ? void 0 : _b.role;
    if (userRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only workspace admins can send invitations.');
    }
    const existingUserQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!existingUserQuery.empty) {
        const existingUserId = existingUserQuery.docs[0].id;
        if ((_c = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.memberIds) === null || _c === void 0 ? void 0 : _c.includes(existingUserId)) {
            throw new functions.https.HttpsError('already-exists', 'A user with this email is already a member of the workspace.');
        }
    }
    const token = generateToken();
    const expires = Date.now() + 24 * 60 * 60 * 1000;
    const inviteRef = db.collection('invites').doc();
    await inviteRef.set({
        workspaceId,
        email,
        token,
        expires,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const appUrl = 'https://saturnsync.com';
    const joinUrl = `${appUrl}/join?token=${token}`;
    return { success: true, joinUrl, workspaceName: workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.name };
});
exports.joinWorkspace = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to accept an invite.');
    }
    const { token } = data;
    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'Invite token is required.');
    }
    const uid = context.auth.uid;
    const authEmail = context.auth.token.email;
    const displayName = context.auth.token.name || authEmail;
    const photoURL = context.auth.token.picture || null;
    const invitesRef = db.collection("invites");
    const inviteQuery = invitesRef.where("token", "==", token).limit(1);
    try {
        const inviteQuerySnapshot = await inviteQuery.get();
        if (inviteQuerySnapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'This invitation is invalid or has already been used.');
        }
        const inviteDoc = inviteQuerySnapshot.docs[0];
        const inviteData = inviteDoc.data();
        const inviteEmail = inviteData.email;
        if (inviteEmail.toLowerCase() !== (authEmail === null || authEmail === void 0 ? void 0 : authEmail.toLowerCase())) {
            throw new functions.https.HttpsError('permission-denied', 'This invitation is not intended for your account.');
        }
        if (inviteData.expires < Date.now()) {
            await inviteDoc.ref.delete();
            throw new functions.https.HttpsError('deadline-exceeded', 'This invitation has expired.');
        }
        const workspaceId = inviteData.workspaceId;
        const workspaceRef = db.doc(`workspaces/${workspaceId}`);
        const userRef = db.doc(`users/${uid}`);
        const prefsDocId = `${uid}-${workspaceId}`;
        const prefsRef = db.doc(`user-workspace-prefs/${prefsDocId}`);
        await db.runTransaction(async (transaction) => {
            var _a;
            const workspaceDoc = await transaction.get(workspaceRef);
            const userDoc = await transaction.get(userRef);
            if (!workspaceDoc.exists) {
                throw new functions.https.HttpsError("not-found", "The workspace you were invited to no longer exists.");
            }
            if (!userDoc.exists) {
                transaction.set(userRef, {
                    uid,
                    email: authEmail,
                    name: displayName,
                    avatarUrl: photoURL,
                    workspaceIds: [],
                });
            }
            const workspaceData = workspaceDoc.data();
            if ((_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.memberIds) === null || _a === void 0 ? void 0 : _a.includes(uid)) {
                transaction.delete(inviteDoc.ref);
                return;
            }
            transaction.update(workspaceRef, {
                memberIds: admin.firestore.FieldValue.arrayUnion(uid),
                [`users.${uid}`]: {
                    role: "contributor",
                    name: displayName,
                    email: authEmail,
                    avatarUrl: photoURL,
                },
            });
            transaction.update(userRef, {
                workspaceIds: admin.firestore.FieldValue.arrayUnion(workspaceId),
            });
            transaction.set(prefsRef, {
                uid: uid,
                workspaceId: workspaceId,
                sidebarModules: defaultSidebarModules,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            transaction.delete(inviteDoc.ref);
        });
        return { success: true, workspaceId: workspaceId };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('Error in joinWorkspace transaction:', error);
        throw new functions.https.HttpsError('internal', 'An unexpected error occurred while trying to join the workspace.');
    }
});
exports.finalizeWorkspaceLogo = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to perform this action.');
    }
    const uid = context.auth.uid;
    const { workspaceId, tempFilePath } = data;
    if (!workspaceId || !tempFilePath) {
        throw new functions.https.HttpsError('invalid-argument', 'Workspace ID and temporary file path are required.');
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceDoc = await workspaceRef.get();
    if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }
    const workspaceData = workspaceDoc.data();
    const userRole = (_b = (_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) === null || _a === void 0 ? void 0 : _a[uid]) === null || _b === void 0 ? void 0 : _b.role;
    if (userRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to change the workspace logo.');
    }
    const bucket = admin.storage().bucket();
    const tempFile = bucket.file(tempFilePath);
    const finalFilePath = `workspaces/${workspaceId}/logo`;
    const finalFile = bucket.file(finalFilePath);
    try {
        await tempFile.move(finalFile);
        await finalFile.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${finalFilePath}`;
        await workspaceRef.update({
            logoUrl: publicUrl
        });
        return { success: true, logoUrl: publicUrl };
    }
    catch (error) {
        console.error("Error moving file or updating Firestore:", error);
        throw new functions.https.HttpsError('internal', 'Failed to finalize workspace logo.');
    }
});
exports.removeUserFromWorkspace = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { workspaceId, userIdToRemove } = data;
    if (!workspaceId || !userIdToRemove) {
        throw new functions.https.HttpsError('invalid-argument', 'workspaceId and userIdToRemove are required');
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceDoc = await workspaceRef.get();
    if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found');
    }
    const workspaceData = workspaceDoc.data();
    const callerRole = (_b = (_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) === null || _a === void 0 ? void 0 : _a[context.auth.uid]) === null || _b === void 0 ? void 0 : _b.role;
    if (callerRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only workspace admins can remove users');
    }
    if ((workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.ownerId) === userIdToRemove) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot remove the workspace owner');
    }
    const userRef = db.doc(`users/${userIdToRemove}`);
    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            transaction.update(workspaceRef, {
                memberIds: admin.firestore.FieldValue.arrayRemove(userIdToRemove),
                [`users.${userIdToRemove}`]: admin.firestore.FieldValue.delete()
            });
            if (userDoc.exists) {
                transaction.update(userRef, {
                    workspaceIds: admin.firestore.FieldValue.arrayRemove(workspaceId)
                });
            }
        });
        return { success: true };
    }
    catch (error) {
        console.error('Error removing user from workspace:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to remove user from workspace');
    }
});
exports.deleteWorkspace = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { workspaceId } = data;
    if (!workspaceId) {
        throw new functions.https.HttpsError('invalid-argument', 'workspaceId is required');
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceDoc = await workspaceRef.get();
    if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found');
    }
    const workspaceData = workspaceDoc.data();
    if ((workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.ownerId) !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the workspace owner can delete the workspace');
    }
    const batch = db.batch();
    if ((workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.memberIds) && Array.isArray(workspaceData.memberIds)) {
        workspaceData.memberIds.forEach(memberId => {
            const userRef = db.doc(`users/${memberId}`);
            batch.update(userRef, {
                workspaceIds: admin.firestore.FieldValue.arrayRemove(workspaceId)
            });
        });
    }
    batch.delete(workspaceRef);
    try {
        await batch.commit();
        return { success: true };
    }
    catch (error) {
        console.error('Error deleting workspace:', error);
        throw new functions.https.HttpsError('internal', 'Failed to delete workspace');
    }
});
exports.generateTeamReport = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to generate reports.');
    }
    const callerUid = context.auth.uid;
    const { workspaceId, userIds } = data;
    if (!workspaceId || !Array.isArray(userIds) || userIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Workspace ID and an array of user IDs are required.');
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceSnap = await workspaceRef.get();
    if (!workspaceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }
    const workspaceData = workspaceSnap.data();
    const callerRole = (_b = (_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) === null || _a === void 0 ? void 0 : _a[callerUid]) === null || _b === void 0 ? void 0 : _b.role;
    if (callerRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only workspace admins can generate team reports.');
    }
    const reportData = [];
    for (const userId of userIds) {
        if (!((_c = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.memberIds) === null || _c === void 0 ? void 0 : _c.includes(userId))) {
            console.warn(`Skipping user ${userId} as they are not a member of workspace ${workspaceId}.`);
            continue;
        }
        const userRef = db.doc(`users/${userId}`);
        const tasksQuery = db.collection(`user-tasks/${userId}/tasks`).where('workspaceId', '==', workspaceId);
        const [userSnap, tasksSnap] = await Promise.all([
            userRef.get(),
            tasksQuery.get(),
        ]);
        const userProfile = userSnap.exists ? Object.assign({ id: userSnap.id }, userSnap.data()) : { uid: userId, name: 'Unnamed User' };
        const tasks = tasksSnap.docs.map(doc => {
            const taskData = doc.data();
            return Object.assign(Object.assign({}, taskData), { id: doc.id });
        });
        reportData.push({
            user: userProfile,
            tasks: tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        });
    }
    return reportData;
});
exports.getUserActivity = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Signed in user only.');
    const { workspaceId, targetUserId } = data;
    if (!workspaceId || !targetUserId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing parameters.');
    // Secure verify: is caller a member?
    const workspaceSnap = await db.doc(`workspaces/${workspaceId}`).get();
    if (!workspaceSnap.exists)
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    const wsData = workspaceSnap.data();
    if (!((_a = wsData === null || wsData === void 0 ? void 0 : wsData.memberIds) === null || _a === void 0 ? void 0 : _a.includes(context.auth.uid)))
        throw new functions.https.HttpsError('permission-denied', 'Membership required.');
    // Query for activities where this user is the Actor OR the Assignee
    const activitiesRef = db.collection(`notifications/${workspaceId}/activities`);
    const q = activitiesRef.where(admin.firestore.Filter.or(admin.firestore.Filter.where('actorUid', '==', targetUserId), admin.firestore.Filter.where('assignee.uid', '==', targetUserId))).orderBy('timestamp', 'desc').limit(20);
    const snapshot = await q.get();
    return snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
});
exports.finalizeFileUpload = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to upload files.');
    }
    const uid = context.auth.uid;
    const { workspaceId, tempFilePath, targetParentPath, fileName, fileSize, mimeType } = data;
    if (!workspaceId || !tempFilePath || !fileName || !fileSize || !mimeType) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required file information.');
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceDoc = await workspaceRef.get();
    if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }
    const workspaceData = workspaceDoc.data();
    if (!((_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.memberIds) === null || _a === void 0 ? void 0 : _a.includes(uid))) {
        throw new functions.https.HttpsError('permission-denied', 'You are not a member of this workspace.');
    }
    const bucket = admin.storage().bucket();
    const tempFile = bucket.file(tempFilePath);
    const finalName = targetParentPath ? `${targetParentPath}/${fileName}` : fileName;
    const finalFilePath = `workspaces/${workspaceId}/files/${finalName}`;
    const finalFile = bucket.file(finalFilePath);
    try {
        await tempFile.move(finalFile);
        await finalFile.makePublic();
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${finalFile.name}`;
        await db.collection('workspace-files').add({
            type: 'file',
            name: fileName,
            fullPath: finalFile.name,
            parentPath: targetParentPath,
            size: fileSize,
            mimeType: mimeType,
            downloadURL: downloadURL,
            uploadedBy: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            workspaceId: workspaceId,
        });
        return { success: true, url: downloadURL };
    }
    catch (error) {
        console.error("Error finalizing file upload:", error);
        throw new functions.https.HttpsError('internal', 'Failed to process the uploaded file.');
    }
});
exports.createFolder = functions.region("us-central1").https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a folder.');
    }
    const uid = context.auth.uid;
    const { workspaceId, parentPath, folderName } = data;
    if (!workspaceId || folderName === undefined || parentPath === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required folder information.');
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceDoc = await workspaceRef.get();
    if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }
    const workspaceData = workspaceDoc.data();
    if (!workspaceData || !((_a = workspaceData.memberIds) === null || _a === void 0 ? void 0 : _a.includes(uid))) {
        throw new functions.https.HttpsError('permission-denied', 'You are not a member of this workspace.');
    }
    const fullPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    try {
        const folderDocRef = await db.collection('workspace-files').add({
            type: 'folder',
            name: folderName,
            fullPath: fullPath,
            parentPath: parentPath,
            uploadedBy: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            workspaceId: workspaceId,
        });
        return { success: true, folderId: folderDocRef.id };
    }
    catch (error) {
        console.error("Error creating folder:", error);
        throw new functions.https.HttpsError('internal', 'Failed to create the folder in the database.');
    }
});
/**
 * Omni-Backfill Migration function.
 * Recursively scans projects, silos, and tasks to ensure proper metadata
 * and re-synchronizes the denormalized user-tasks collection for the dashboard.
 */
exports.backfillAllProjects = functions
    .region("us-central1")
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onCall(async (data, context) => {
    var _a, _b, _c;
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
        }
        const db = admin.firestore();
        let updatedCount = 0;
        let tasksSyncedCount = 0;
        console.log("Starting deep sync migration...");
        // 1. Sync ALL Projects
        const projectsSnap = await db.collectionGroup("projects").get();
        for (const docSnap of projectsSnap.docs) {
            const segments = docSnap.ref.path.split("/");
            if (segments[0] === "workspaces" && segments[2] === "companies") {
                const workspaceId = segments[1];
                const companyId = segments[3];
                await docSnap.ref.update({ workspaceId, companyId });
                updatedCount++;
            }
        }
        // 2. Sync ALL Silos
        const silosSnap = await db.collectionGroup("silos").get();
        for (const docSnap of silosSnap.docs) {
            const segments = docSnap.ref.path.split("/");
            if (segments[0] === "workspaces" && segments[2] === "companies" && segments[4] === "projects") {
                const workspaceId = segments[1];
                await docSnap.ref.update({ workspaceId });
                updatedCount++;
            }
        }
        // 3. Sync and Re-denormalize ALL Tasks
        const tasksSnap = await db.collectionGroup("tasks").get();
        for (const taskDoc of tasksSnap.docs) {
            const taskData = taskDoc.data();
            const segments = taskDoc.ref.path.split("/");
            // Expected: workspaces/{wsId}/companies/{coId}/projects/{prId}/silos/{siId}/tasks/{tId}
            if (segments.length >= 10 && segments[0] === "workspaces") {
                const workspaceId = segments[1];
                const companyId = segments[3];
                const projectId = segments[5];
                const siloId = segments[7];
                // Update source task with correct IDs
                await taskDoc.ref.update({ workspaceId, companyId, projectId, type: 'original' });
                updatedCount++;
                // Synchronize with user-tasks collection
                if (taskData.assigneeId) {
                    // Get names for denormalization
                    const [companySnap, projectSnap, siloSnap] = await Promise.all([
                        db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
                        db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
                        db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get()
                    ]);
                    const companyName = ((_a = companySnap.data()) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Company';
                    const projectName = projectId === 'general-tasks' ? 'Quick Tasks' : (((_b = projectSnap.data()) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown Project');
                    const siloName = ((_c = siloSnap.data()) === null || _c === void 0 ? void 0 : _c.name) || 'Inbox';
                    const userTasksRef = db.collection(`user-tasks/${taskData.assigneeId}/tasks`);
                    const existingQuery = await userTasksRef.where("originalTaskId", "==", taskDoc.id).get();
                    const denormalizedData = {
                        originalTaskId: taskDoc.id,
                        workspaceId,
                        companyId,
                        projectId,
                        siloId,
                        title: taskData.title,
                        description: taskData.description || '',
                        completed: taskData.completed || false,
                        completedAt: taskData.completed ? (taskData.completedAt || admin.firestore.FieldValue.serverTimestamp()) : null,
                        dueDate: taskData.dueDate || new Date().toISOString(),
                        priority: taskData.priority || 'medium',
                        assigneeId: taskData.assigneeId,
                        createdBy: taskData.createdBy || 'migration',
                        companyName,
                        projectName,
                        siloName,
                        timeSpentMinutes: taskData.timeSpentMinutes || 0,
                        createdAt: taskData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                        type: 'denormalized'
                    };
                    if (existingQuery.empty) {
                        await userTasksRef.add(denormalizedData);
                    }
                    else {
                        await existingQuery.docs[0].ref.set(denormalizedData, { merge: true });
                    }
                    tasksSyncedCount++;
                }
            }
        }
        console.log(`Migration completed. itemsTagged=${updatedCount}, tasksSynced=${tasksSyncedCount}`);
        return {
            success: true,
            updatedCount,
            tasksSyncedCount,
        };
    }
    catch (err) {
        console.error("Migration failed:", err);
        throw new functions.https.HttpsError("internal", (err === null || err === void 0 ? void 0 : err.message) || "Internal error during migration.");
    }
});
async function publishToFacebook(postDoc) {
    var _a;
    const post = postDoc.data();
    const pathSegments = postDoc.ref.path.split('/');
    const workspaceId = pathSegments[1];
    const companyId = pathSegments[3];
    const companyRef = db.doc(`workspaces/${workspaceId}/companies/${companyId}`);
    const companySnap = await companyRef.get();
    if (!companySnap.exists) {
        console.warn('publishToFacebook: company not found for', companyRef.path);
        return 'failed';
    }
    const companyData = companySnap.data();
    const fbConfig = (_a = companyData === null || companyData === void 0 ? void 0 : companyData.socialIntegration) === null || _a === void 0 ? void 0 : _a.facebook;
    if (!(fbConfig === null || fbConfig === void 0 ? void 0 : fbConfig.pageId) || !(fbConfig === null || fbConfig === void 0 ? void 0 : fbConfig.pageAccessToken)) {
        console.log('publishToFacebook: no facebook config, skipping', companyRef.path);
        return 'skip';
    }
    const message = post.captionDefault || '';
    if (!message.trim()) {
        console.log('publishToFacebook: empty message, skipping', postDoc.ref.path);
        return 'skip';
    }
    const url = `https://graph.facebook.com/v19.0/${fbConfig.pageId}/feed`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                access_token: fbConfig.pageAccessToken,
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error('publishToFacebook: Facebook API error', res.status, text);
            return 'failed';
        }
        const data = await res.json();
        console.log('publishToFacebook: success, facebook response:', data);
        return 'success';
    }
    catch (err) {
        console.error('publishToFacebook: network error', err);
        return 'failed';
    }
}
exports.publishSocialPosts = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
    try {
        console.log('publishSocialPosts: function started at', new Date().toISOString());
        const now = new Date();
        const snapshot = await db
            .collectionGroup('socialPosts')
            .where('scheduledAt', '<=', now)
            .get();
        console.log('publishSocialPosts: found (by date only)', snapshot.size, 'posts');
        if (snapshot.empty) {
            return null;
        }
        const batch = db.batch();
        const updateTimestamp = admin.firestore.FieldValue.serverTimestamp();
        for (const doc of snapshot.docs) {
            const post = doc.data();
            if (!['approved', 'scheduled'].includes(post.status)) {
                continue;
            }
            const platforms = post.platforms || [];
            let anyFailed = false;
            let anySuccess = false;
            if (platforms.includes('facebook')) {
                const result = await publishToFacebook(doc);
                if (result === 'failed')
                    anyFailed = true;
                if (result === 'success')
                    anySuccess = true;
            }
            let newStatus = post.status;
            let errorMessage = null;
            if (anyFailed) {
                newStatus = 'failed';
                errorMessage = 'One or more platforms failed to publish.';
            }
            else if (anySuccess) {
                newStatus = 'published';
            }
            if (newStatus !== post.status) {
                batch.update(doc.ref, {
                    status: newStatus,
                    errorMessage,
                    updatedAt: updateTimestamp,
                });
            }
        }
        await batch.commit();
        console.log('publishSocialPosts: batch commit complete.');
        return null;
    }
    catch (error) {
        console.error('Error publishing social posts:', error);
        return null;
    }
});
exports.setCompanyFacebookConfig = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to perform this action.');
    }
    const uid = context.auth.uid;
    const { workspaceId, companyId, pageId, pageName, pageAccessToken } = data;
    if (!workspaceId || !companyId || !pageId || !pageName || !pageAccessToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters for Facebook configuration.');
    }
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    try {
        const workspaceSnap = await workspaceRef.get();
        if (!workspaceSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Workspace not found.');
        }
        const workspaceData = workspaceSnap.data();
        const userRole = (_b = (_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) === null || _a === void 0 ? void 0 : _a[uid]) === null || _b === void 0 ? void 0 : _b.role;
        if (userRole !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'You must be a workspace admin to configure social media integrations.');
        }
    }
    catch (error) {
        console.error("Permission check failed:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'An error occurred while verifying your permissions.');
    }
    const companyRef = db.doc(`workspaces/${workspaceId}/companies/${companyId}`);
    const facebookConfig = {
        pageId,
        pageName,
        pageAccessToken,
        connectedBy: uid,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    try {
        await companyRef.update({
            'socialIntegration.facebook': facebookConfig,
        });
        return { success: true };
    }
    catch (error) {
        console.error("Error updating company document with Facebook config:", error);
        throw new functions.https.HttpsError('internal', 'Failed to save the Facebook configuration to the company.');
    }
});
//# sourceMappingURL=index.js.map