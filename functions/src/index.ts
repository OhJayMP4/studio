'use server';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

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
        const workspaceDoc = await transaction.get(workspaceRef);

        if (!workspaceDoc.exists) {
          throw new functions.https.HttpsError("not-found", "The workspace you were invited to no longer exists.");
        }

        const workspaceData = workspaceDoc.data();
        if (workspaceData?.memberIds?.includes(uid)) {
          transaction.delete(inviteDoc.ref); // Clean up invite if already a member
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
  } catch (error) {
     if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error('Error in joinWorkspace transaction:', error);
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while trying to join the workspace.');
  }
});
