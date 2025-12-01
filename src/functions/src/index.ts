
'use server';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface UserTask {
    id: string;
    originalTaskId: string;
    workspaceId: string;
    companyId: string;
    projectId: string;
    siloId: string;
    title: string;
    description?: string;
    completed: boolean;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    assigneeId: string;
    companyName: string;
    projectName: string;
    siloName: string;
}

const defaultSidebarModules = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', route: '/dashboard', hidden: false, order: 0 },
    { id: 'companies', label: 'Companies', icon: 'Building', route: '/companies', hidden: false, order: 1 },
    { id: 'reporting', label: 'Reporting', icon: 'BarChart', route: '/reporting', hidden: false, order: 2 },
    { id: 'my-tasks', label: 'My Tasks', icon: 'ClipboardCheck', route: '/my-tasks', hidden: false, order: 3 },
]


admin.initializeApp();
const db = admin.firestore();

// Helper to get user info and workspace members
const getActorAndRelevantUsers = async (workspaceId: string, actorUid: string) => {
    const workspaceSnap = await db.doc(`workspaces/${workspaceId}`).get();
    if (!workspaceSnap.exists) {
        console.error(`Workspace ${workspaceId} not found.`);
        return { actorName: null, isRelevantTo: [] };
    }
    const workspaceData = workspaceSnap.data();
    const actor = workspaceData?.users?.[actorUid];
    const actorName = actor?.name || 'A user';
    const isRelevantTo = Object.keys(workspaceData?.users || {}).filter(uid => uid !== actorUid);
    return { actorName, isRelevantTo };
};

// Helper to create a notification document
const createNotification = async (workspaceId: string, notificationData: any) => {
    try {
        await db.collection(`notifications/${workspaceId}/activities`).add({
            ...notificationData,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            readBy: [],
        });
    } catch (error) {
        console.error(`Failed to create notification for workspace ${workspaceId}:`, error);
    }
};

// --- Notification Triggers ---

exports.onCommentCreate = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}/projects/{projectId}/silos/{siloId}/tasks/{taskId}/comments/{commentId}')
    .onCreate(async (snap, context) => {
        const { workspaceId, companyId, projectId, siloId, taskId } = context.params;
        const commentData = snap.data();
        
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, commentData.createdBy);
        if (!actorName) return;

        const [companySnap, projectSnap, taskSnap] = await Promise.all([
            db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}/tasks/${taskId}`).get()
        ]);
        
        const companyName = companySnap.data()?.name || '';
        const projectName = projectSnap.data()?.name || '';
        const taskTitle = taskSnap.data()?.title || '';

        await createNotification(workspaceId, {
            type: 'comment_added',
            actorUid: commentData.createdBy,
            actorName,
            target: { id: taskId, name: taskTitle, type: 'task', path: `/company/${companyId}/project/${projectId}` },
            context: { 
                companyName, 
                projectName,
                commentText: commentData.text,
            },
            isRelevantTo,
        });
    });

// On Company Create
exports.onCompanyCreate = functions.firestore
    .document('workspaces/{workspaceId}/companies/{companyId}')
    .onCreate(async (snap, context) => {
        const { workspaceId } = context.params;
        const companyData = snap.data();
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, companyData.createdBy);

        if (!actorName) return;

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
        const { workspaceId, companyId } = context.params;
        const projectData = snap.data();
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, projectData.createdBy);
        
        if (!actorName) return;
        
        const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
        const companyName = companySnap.exists ? companySnap.data()?.name : '';
        
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
        const { workspaceId, companyId, projectId } = context.params;
        const siloData = snap.data();
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, siloData.createdBy);

        if (!actorName) return;

        const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
        const projectSnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get();
        const companyName = companySnap.exists ? companySnap.data()?.name : '';
        const projectName = projectSnap.exists ? projectSnap.data()?.name : '';

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
        const { workspaceId, companyId, projectId } = context.params;
        const saleData = snap.data();
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, saleData.createdBy);

        if (!actorName) return;

        const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
        const projectSnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get();
        const companyName = companySnap.exists ? companySnap.data()?.name : '';
        const projectName = projectSnap.exists ? projectSnap.data()?.name : '';

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
        const { workspaceId, companyId, projectId, siloId, taskId } = context.params;
        
        const beforeData = change.before.data();
        const afterData = change.after.data();

        // Task Creation or Re-assignment
        if (afterData && (!beforeData || beforeData.assigneeId !== afterData.assigneeId)) {
            const actorUid = afterData.updatedBy || afterData.createdBy;
            const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
            if (!actorName) return;

            const [companySnap, projectSnap, siloSnap, assigneeSnap] = await Promise.all([
                db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
                db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
                db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get(),
                db.doc(`users/${afterData.assigneeId}`).get()
            ]);

            const companyName = companySnap.data()?.name || '';
            const projectName = projectSnap.data()?.name || '';
            const siloName = siloSnap.data()?.name || '';
            const assigneeName = assigneeSnap.exists ? assigneeSnap.data()?.name : 'an unknown user';
            
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
             if (!actorName) return;

            const [companySnap, projectSnap, siloSnap] = await Promise.all([
                db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
                db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
                db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get()
            ]);
            const companyName = companySnap.data()?.name || '';
            const projectName = projectSnap.data()?.name || '';
            const siloName = siloSnap.data()?.name || '';

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

        if (!actorName) return;

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
        const { workspaceId, companyId } = context.params;
        const projectData = snap.data();
        const actorUid = projectData.updatedBy || projectData.createdBy;
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
        
        if (!actorName) return;
        
        const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
        const companyName = companySnap.exists ? companySnap.data()?.name : '';
        
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
        const { workspaceId, companyId, projectId } = context.params;
        const siloData = snap.data();
        const actorUid = siloData.updatedBy || siloData.createdBy;
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);

        if (!actorName) return;

        const companySnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get();
        const projectSnap = await db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get();
        const companyName = companySnap.exists ? companySnap.data()?.name : '';
        const projectName = projectSnap.exists ? projectSnap.data()?.name : '';

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
        const { workspaceId, companyId, projectId, siloId } = context.params;
        const taskData = snap.data();
        const actorUid = taskData.updatedBy || taskData.createdBy;
        const { actorName, isRelevantTo } = await getActorAndRelevantUsers(workspaceId, actorUid);
        if (!actorName) return;

        const [companySnap, projectSnap, siloSnap] = await Promise.all([
            db.doc(`workspaces/${workspaceId}/companies/${companyId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}`).get(),
            db.doc(`workspaces/${workspaceId}/companies/${companyId}/projects/${projectId}/silos/${siloId}`).get()
        ]);

        const companyName = companySnap.data()?.name || '';
        const projectName = projectSnap.data()?.name || '';
        const siloName = siloSnap.data()?.name || '';
        
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
            const isMember = workspaceData?.memberIds?.includes(uploadedBy);

            if (!isMember) {
                throw new Error(`User ${uploadedBy} is not a member of workspace ${workspaceId}.`);
            }

            console.log(`File ${fileId} uploaded by valid member ${uploadedBy}.`);

        } catch (error) {
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



// Generate a simple random token
const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

exports.createInvite = functions.https.onCall(async (data, context) => {
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
    const userRole = workspaceData?.users?.[uid]?.role;

    if (userRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only workspace admins can send invitations.');
    }

    // Check if user is already a member
    const existingUserQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!existingUserQuery.empty) {
        const existingUserId = existingUserQuery.docs[0].id;
        if (workspaceData?.memberIds?.includes(existingUserId)) {
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
    
    return { success: true, joinUrl, workspaceName: workspaceData?.name };
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
    if (inviteEmail.toLowerCase() !== authEmail?.toLowerCase()) {
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
        if (workspaceData?.memberIds?.includes(uid)) {
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

        // Create default sidebar preferences for the user in this workspace
        transaction.set(prefsRef, {
            uid: uid,
            workspaceId: workspaceId,
            sidebarModules: defaultSidebarModules,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Delete the used invite
        transaction.delete(inviteDoc.ref);
    });

    return { success: true, workspaceId: workspaceId };
  } catch (error) {
     if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error('Error in joinWorkspace transaction:', error);
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while trying to join the workspace.');
  }
});


exports.finalizeWorkspaceLogo = functions.https.onCall(async (data, context) => {
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
    const userRole = workspaceData?.users?.[uid]?.role;

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
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${finalFilePath}`;

        // 4. Update the Firestore document with the new public URL
        await workspaceRef.update({
            logoUrl: publicUrl
        });

        return { success: true, logoUrl: publicUrl };

    } catch (error) {
        console.error("Error moving file or updating Firestore:", error);
        throw new functions.https.HttpsError('internal', 'Failed to finalize workspace logo.');
    }
});

exports.removeUserFromWorkspace = functions.https.onCall(async (data, context) => {
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
  const callerRole = workspaceData?.users?.[context.auth.uid]?.role;
  
  if (callerRole !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only workspace admins can remove users');
  }

  // Prevent removing the owner
  if (workspaceData?.ownerId === userIdToRemove) {
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
  } catch (error) {
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
    if (workspaceData?.ownerId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the workspace owner can delete the workspace');
    }

    const batch = db.batch();

    // 1. Remove workspaceId from all members' user profiles
    if (workspaceData?.memberIds && Array.isArray(workspaceData.memberIds)) {
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
    } catch (error) {
        console.error('Error deleting workspace:', error);
        throw new functions.https.HttpsError('internal', 'Failed to delete workspace');
    }
});


exports.generateTeamReport = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to generate reports.');
    }
    const callerUid = context.auth.uid;
    const { workspaceId, userIds } = data;

    if (!workspaceId || !Array.isArray(userIds) || userIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Workspace ID and an array of user IDs are required.');
    }

    // 2. Permission Check (Caller must be an admin of the workspace)
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceSnap = await workspaceRef.get();

    if (!workspaceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }

    const workspaceData = workspaceSnap.data();
    const callerRole = workspaceData?.users?.[callerUid]?.role;

    if (callerRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only workspace admins can generate team reports.');
    }

    // 3. Fetch Data for each user
    const reportData = [];

    for (const userId of userIds) {
        // Security check: Ensure the target user is also in the same workspace.
        if (!workspaceData?.memberIds?.includes(userId)) {
            console.warn(`Skipping user ${userId} as they are not a member of workspace ${workspaceId}.`);
            continue;
        }

        const userRef = db.doc(`users/${userId}`);
        const tasksQuery = db.collection(`user-tasks/${userId}/tasks`).where('workspaceId', '==', workspaceId);

        const [userSnap, tasksSnap] = await Promise.all([
            userRef.get(),
            tasksQuery.get(),
        ]);

        const userProfile = userSnap.exists ? { id: userSnap.id, ...userSnap.data() } : { uid: userId, name: 'Unknown User' };
        const tasks = tasksSnap.docs.map(doc => {
            const taskData = doc.data() as UserTask;
            return {
                ...taskData,
                id: doc.id,
            };
        });

        reportData.push({
            user: userProfile,
            tasks: tasks.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        });
    }

    return reportData;
});

exports.finalizeFileUpload = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to upload files.');
    }
    const uid = context.auth.uid;
    const { workspaceId, tempFilePath, targetParentPath, fileName, fileSize, mimeType } = data;

    if (!workspaceId || !tempFilePath || !fileName || !fileSize || !mimeType) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required file information.');
    }

    // 2. Permission Check (Is user a member of the workspace?)
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceDoc = await workspaceRef.get();
    if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }
    const workspaceData = workspaceDoc.data();
    if (!workspaceData?.memberIds?.includes(uid)) {
        throw new functions.https.HttpsError('permission-denied', 'You are not a member of this workspace.');
    }

    // 3. Move the file in Cloud Storage
    const bucket = admin.storage().bucket();
    const tempFile = bucket.file(tempFilePath);

    const finalName = targetParentPath ? `${targetParentPath}/${fileName}` : fileName;
    const finalFilePath = `workspaces/${workspaceId}/files/${finalName}`;
    const finalFile = bucket.file(finalFilePath);

    try {
        await tempFile.move(finalFile);
        
        // Make the file public to get a consistent URL
        await finalFile.makePublic();

        // Construct the public URL
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${finalFile.name}`;

        // 4. Create the Firestore document for the new file
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

    } catch (error) {
        console.error("Error finalizing file upload:", error);
        throw new functions.https.HttpsError('internal', 'Failed to process the uploaded file.');
    }
});


exports.createFolder = functions.region("us-central1").https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a folder.');
    }
    const uid = context.auth.uid;
    const { workspaceId, parentPath, folderName } = data;
    
    if (!workspaceId || folderName === undefined || parentPath === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required folder information.');
    }

    // 2. Permission Check
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspaceDoc = await workspaceRef.get();
    if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }
    const workspaceData = workspaceDoc.data();
    if (!workspaceData || !workspaceData.memberIds?.includes(uid)) {
        throw new functions.https.HttpsError('permission-denied', 'You are not a member of this workspace.');
    }

    // 3. Create Firestore document for the folder
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
    } catch (error) {
        console.error("Error creating folder:", error);
        throw new functions.https.HttpsError('internal', 'Failed to create the folder in the database.');
    }
});

exports.backfillAllProjects = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context) => {
    try {
      // 1) Auth check
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "You must be signed in to run this migration."
        );
      }

      // 2) Restrict who can run it
      const callerEmail = context.auth.token.email;
      const allowedEmails = [
        "marketing@saturnmanagement.co.za",
        // add more admin emails if needed
      ];
      if (!allowedEmails.includes(callerEmail as string)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          `User ${callerEmail} is not allowed to run this migration.`
        );
      }

      const db = admin.firestore();

      let updatedCount = 0;
      let strayCount = 0;
      let deletedCount = 0;

      console.log("Starting backfillAllProjects migration...");

      // 3) Grab ALL 'projects' documents in the database
      const snap = await db.collectionGroup("projects").get();
      console.log(`Found ${snap.size} project documents in collectionGroup.`);

      for (const docSnap of snap.docs) {
        const data = docSnap.data() || {};
        const path = docSnap.ref.path;
        const segments = path.split("/");

        // Expecting: workspaces/{wsId}/companies/{companyId}/projects/{projectId}
        const isNestedProject =
          segments.length >= 6 &&
          segments[0] === "workspaces" &&
          segments[2] === "companies" &&
          segments[4] === "projects";

        if (isNestedProject) {
          const workspaceId = segments[1];
          const companyId = segments[3];

          const needsWorkspaceFix =
            !data.workspaceId || data.workspaceId !== workspaceId;
          const needsCompanyFix =
            !data.companyId || data.companyId !== companyId;

          if (needsWorkspaceFix || needsCompanyFix) {
            console.log(
              `Updating nested project ${path} (workspaceId=${workspaceId}, companyId=${companyId})`
            );
            const updates: any = {};
            if (needsWorkspaceFix) updates.workspaceId = workspaceId;
            if (needsCompanyFix) updates.companyId = companyId;

            await docSnap.ref.update(updates);
            updatedCount++;
          }
        } else {
          // This is a 'projects' doc OUTSIDE the expected path
          strayCount++;
          console.warn(
            `Stray project document outside expected structure: ${path}`
          );

          // OPTION A: Just log them, do not delete:
          // continue;

          // OPTION B (stricter): delete them because they are invalid / test data:
          // await docSnap.ref.delete();
          // deletedCount++;
        }
      }

      console.log(
        `backfillAllProjects completed. updated=${updatedCount}, stray=${strayCount}, deleted=${deletedCount}`
      );

      return {
        success: true,
        updatedCount,
        strayCount,
        deletedCount,
      };
    } catch (err: any) {
      console.error("Migration failed in backfillAllProjects:", err);

      if (err instanceof functions.https.HttpsError) {
        throw err;
      }

      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Unknown internal error during backfillAllProjects."
      );
    }
  });


async function publishToFacebook(postDoc: admin.firestore.DocumentSnapshot): Promise<'success' | 'skip' | 'failed'> {
  const post = postDoc.data() as any;
  const pathSegments = postDoc.ref.path.split('/');
  // path: workspaces/{workspaceId}/companies/{companyId}/socialPosts/{postId}
  const workspaceId = pathSegments[1];
  const companyId   = pathSegments[3];

  const companyRef = db.doc(`workspaces/${workspaceId}/companies/${companyId}`);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    console.warn('publishToFacebook: company not found for', companyRef.path);
    return 'failed';
  }

  const companyData = companySnap.data() as any;
  const fbConfig = companyData?.socialIntegration?.facebook;

  if (!fbConfig?.pageId || !fbConfig?.pageAccessToken) {
    console.log('publishToFacebook: no facebook config, skipping', companyRef.path);
    return 'skip';
  }

  // For now, only publish caption text (no media)
  const message: string = post.captionDefault || '';
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
  } catch (err) {
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
        const post = doc.data() as any;

        if (!['approved', 'scheduled'].includes(post.status)) {
          continue;
        }

        const platforms: string[] = post.platforms || [];
        let anyFailed = false;
        let anySuccess = false;

        if (platforms.includes('facebook')) {
          const result = await publishToFacebook(doc);
          if (result === 'failed') anyFailed = true;
          if (result === 'success') anySuccess = true;
        }

        // Later: instagram, linkedin, etc

        let newStatus = post.status;
        let errorMessage = null;

        if (anyFailed) {
          newStatus = 'failed';
          errorMessage = 'One or more platforms failed to publish.';
        } else if (anySuccess) {
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
    } catch (error) {
      console.error('Error publishing social posts:', error);
      return null;
    }
  });


exports.setCompanyFacebookConfig = functions.https.onCall(async (data, context) => {
  // 1. Auth Check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  }
  const uid = context.auth.uid;
  const { workspaceId, companyId, pageId, pageName, pageAccessToken } = data;

  // 2. Input Validation
  if (!workspaceId || !companyId || !pageId || !pageName || !pageAccessToken) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters for Facebook configuration.');
  }

  // 3. Permission Check
  const workspaceRef = db.doc(`workspaces/${workspaceId}`);
  try {
    const workspaceSnap = await workspaceRef.get();
    if (!workspaceSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Workspace not found.');
    }
    const workspaceData = workspaceSnap.data();
    const userRole = workspaceData?.users?.[uid]?.role;

    if (userRole !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'You must be a workspace admin to configure social media integrations.');
    }
  } catch (error) {
    console.error("Permission check failed:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An error occurred while verifying your permissions.');
  }

  // 4. Update Firestore Document
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
  } catch (error) {
    console.error("Error updating company document with Facebook config:", error);
    throw new functions.https.HttpsError('internal', 'Failed to save the Facebook configuration to the company.');
  }
});
