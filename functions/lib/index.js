"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
    const email = context.auth.token.email;
    const displayName = context.auth.token.name || email;
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
        // Validate the invite is for the correct user
        if (inviteData.email !== email) {
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
                    email,
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
//# sourceMappingURL=index.js.map