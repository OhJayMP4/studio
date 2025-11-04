"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// Helper to get user info and workspace members
const getActorAndRelevantUsers = async (workspaceId, actorUid) => {
    var _a;
    const workspaceSnap = await db.doc(`workspaces/${workspaceId}`).get();
    if (!workspaceSnap.exists) {
        console.error(`Workspace ${workspaceId} not found.`);
        return { actorName: null, isRelevantTo: [] };
    }
    const workspaceData = workspaceSnap.data();
    const actor = (_a = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) === null || _a === void 0 ? void 0 : _a[actorUid];
    const actorName = (actor === null || actor === void 0 ? void 0 : actor.name) || 'A user';
    const isRelevantTo = Object.keys((workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.users) || {}).filter(uid => uid !== actorUid);
    return { actorName, isRelevantTo };
};
// Helper to create a notification document
const createNotification = async (workspaceId, notificationData) => {
    try {
        await db.collection(`notifications/${workspaceId}/activities`).add(Object.assign(Object.assign({}, notificationData), { timestamp: admin.firestore.FieldValue.serverTimestamp(), readBy: [] }));
    }
    catch (error) {
        console.error(`Failed to create notification for workspace ${workspaceId}:`, error);
    }
};
// --- Notification Triggers ---
// On Company Create
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
// On Project Create
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
// On Silo Create
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
// On Sale Create
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
});
// On Task Create & Update
exports.onTaskWrite = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}/tasks/{taskId}')
    .onWrite(async (change, context) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const { workspaceId, companyId, projectId, siloId } = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    // Task Creation or Re-assignment
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
        const assigneeName = assigneeSnap.exists ? (_d = assigneeSnap.data()) === null || _d === void 0 ? void 0 : _d.name : 'an unknown user';
        await createNotification(workspaceId, {
            type: 'task_assigned',
            actorUid,
            actorName,
            target: { id: change.after.id, name: afterData.title, type: 'task', path: `/company/${companyId}/project/${projectId}` },
            assignee: { uid: afterData.assigneeId, name: assigneeName },
            context: { companyName, projectName, siloName },
            isRelevantTo,
        });
    }
    // Task Completion
    if (beforeData && afterData && beforeData.completed === false && afterData.completed === true) {
        // The person completing the task is the assignee.
        const actorUid = afterData.assigneeId;
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
        if (!actorName)
            return;
        const [companySnap, projectSnap, siloSnap] = await Promise.all([
            db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get()
        ]);
        const companyName = ((_e = companySnap.data()) === null || _e === void 0 ? void 0 : _e.name) || '';
        const projectName = ((_f = projectSnap.data()) === null || _f === void 0 ? void 0 : _f.name) || '';
        const siloName = ((_g = siloSnap.data()) === null || _g === void 0 ? void 0 : _g.name) || '';
        await createNotification(workspaceId, {
            type: 'task_completed',
            actorUid,
            actorName,
            target: { id: change.after.id, name: afterData.title, type: 'task', path: `/company/${companyId}/project/${projectId}` },
            context: { companyName, projectName, siloName },
            isRelevantTo,
        });
    }
});
// --- Deletion Triggers ---
exports.onCompanyDelete = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}')
    .onDelete(async (snap, context) => {
    const { workspaceId } = context.params;
    const companyData = snap.data();
    // Assume the last user to touch it is the deleter - this is an assumption
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
        type: 'silo_deleted',
        actorUid,
        actorName,
        target: { id: snap.id, name: siloData.name, type: 'silo', path: `/company/${companyId}/project/${projectId}` },
        context: { companyName, projectName },
        isRelevantTo,
    });
});
exports.onTaskDelete = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}/tasks/{taskId}')
    .onDelete(async (snap, context) => {
    var _a, _b, _c;
    const { workspaceId, companyId, projectId, siloId } = context.params;
    const taskData = snap.data();
    const actorUid = taskData.updatedBy || taskData.createdBy;
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
// Generate a simple random token
const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
exports.createInvite = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to send invites.');
    }
    const uid = context.auth.uid;
    const { workspaceId, email } = data;
    if (!workspaceId || !email) {
        throw new functions.https.HttpsError('invalid-argument', 'Workspace ID and email are required.');
    }
    // 2. Permission Check & Data Validation
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
    // Check if user is already a member
    const existingUserQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!existingUserQuery.empty) {
        const existingUserId = existingUserQuery.docs[0].id;
        if ((_c = workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.memberIds) === null || _c === void 0 ? void 0 : _c.includes(existingUserId)) {
            throw new functions.https.HttpsError('already-exists', 'A user with this email is already a member of the workspace.');
        }
    }
    // 3. Create Invite in Firestore
    const token = generateToken();
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours in millis
    const inviteRef = db.collection('invites').doc(); // Use auto-generated ID
    await inviteRef.set({
        workspaceId,
        email,
        token,
        expires,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // 4. Form the Join URL and return it to the client
    const appUrl = 'https://saturnsync.com';
    const joinUrl = `${appUrl}/join?token=${token}`;
    return { success: true, joinUrl, workspaceName: workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.name };
});
exports.joinWorkspace = functions.https.onCall(async (data, context) => {
    // Auth check
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
        // Validate the invite is for the correct user (case-insensitive)
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
        await db.runTransaction(async (transaction) => {
            var _a;
            const workspaceDoc = await transaction.get(workspaceRef);
            const userDoc = await transaction.get(userRef);
            if (!workspaceDoc.exists) {
                throw new functions.https.HttpsError("not-found", "The workspace you were invited to no longer exists.");
            }
            if (!userDoc.exists) {
                // Create the user profile if it doesn't exist
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
                // If user is already a member, we can just delete the invite and exit gracefully.
                transaction.delete(inviteDoc.ref);
                return;
            }
            // Add user to the workspace
            transaction.update(workspaceRef, {
                memberIds: admin.firestore.FieldValue.arrayUnion(uid),
                [`users.${uid}`]: {
                    role: "contributor", // Default role for invited users
                    name: displayName,
                    avatarUrl: photoURL,
                },
            });
            // Add workspace to the user's profile
            transaction.update(userRef, {
                workspaceIds: admin.firestore.FieldValue.arrayUnion(workspaceId),
            });
            // Delete the used invite
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
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to perform this action.');
    }
    const uid = context.auth.uid;
    const { workspaceId, tempFilePath } = data;
    if (!workspaceId || !tempFilePath) {
        throw new functions.https.HttpsError('invalid-argument', 'Workspace ID and temporary file path are required.');
    }
    // 2. Permission Check (Is user an admin of the workspace?)
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
    // 3. Move the file in Cloud Storage
    const bucket = admin.storage().bucket();
    const tempFile = bucket.file(tempFilePath);
    const finalFilePath = `workspaces/${workspaceId}/logo`;
    const finalFile = bucket.file(finalFilePath);
    try {
        await tempFile.move(finalFile);
        // Make the file public
        await finalFile.makePublic();
        const publicUrl = finalFile.publicUrl();
        // 4. Update the Firestore document with the new public URL
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
    // Auth check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { workspaceId, userIdToRemove } = data;
    if (!workspaceId || !userIdToRemove) {
        throw new functions.https.HttpsError('invalid-argument', 'workspaceId and userIdToRemove are required');
    }
    // Get workspace and verify caller is admin
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
    // Prevent removing the owner
    if ((workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.ownerId) === userIdToRemove) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot remove the workspace owner');
    }
    // Remove user from workspace and workspace from user in a transaction
    const userRef = db.doc(`users/${userIdToRemove}`);
    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            // Remove user from workspace's members list and user map
            transaction.update(workspaceRef, {
                memberIds: admin.firestore.FieldValue.arrayRemove(userIdToRemove),
                [`users.${userIdToRemove}`]: admin.firestore.FieldValue.delete()
            });
            // If the user document exists, remove the workspace from their profile's list
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
    // Auth check
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
    // Permission check: only owner can delete
    if ((workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.ownerId) !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the workspace owner can delete the workspace');
    }
    const batch = db.batch();
    // 1. Remove workspaceId from all members' user profiles
    if ((workspaceData === null || workspaceData === void 0 ? void 0 : workspaceData.memberIds) && Array.isArray(workspaceData.memberIds)) {
        workspaceData.memberIds.forEach(memberId => {
            const userRef = db.doc(`users/${memberId}`);
            batch.update(userRef, {
                workspaceIds: admin.firestore.FieldValue.arrayRemove(workspaceId)
            });
        });
    }
    // 2. TODO: Delete all sub-collections (companies, projects, etc.). This is complex and requires recursive deletion.
    // For now, we will just delete the main workspace document. A more robust solution would handle this.
    // 3. Delete the workspace document itself
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
//# sourceMappingURL=index.js.map