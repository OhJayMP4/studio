import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const joinWorkspace = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to join a workspace."
    );
  }

  const { token } = data;
  if (!token || typeof token !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A valid invitation token must be provided."
    );
  }

  const { uid, email } = context.auth;
  const displayName = context.auth.token.name || email;
  const photoURL = context.auth.token.picture || null;

  const invitesRef = db.collection("invites");
  const inviteQuery = await invitesRef
    .where("token", "==", token)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (inviteQuery.empty) {
    throw new functions.https.HttpsError(
      "not-found",
      "This invitation is invalid, expired, or not intended for you."
    );
  }

  const inviteDoc = inviteQuery.docs[0];
  const inviteData = inviteDoc.data();

  if (inviteData.expires < Date.now()) {
    await inviteDoc.ref.delete();
    throw new functions.https.HttpsError(
      "deadline-exceeded",
      "This invitation has expired."
    );
  }

  const workspaceRef = db.doc(`workspaces/${inviteData.workspaceId}`);
  const userRef = db.doc(`users/${uid}`);

  try {
    await db.runTransaction(async (transaction) => {
      const workspaceDoc = await transaction.get(workspaceRef);

      if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "The workspace you were invited to no longer exists."
        );
      }
      
      const workspaceData = workspaceDoc.data();
      if (workspaceData?.memberIds?.includes(uid)) {
        // User is already a member, just delete the invite and succeed.
        transaction.delete(inviteDoc.ref);
        return;
      }

      transaction.update(workspaceRef, {
        memberIds: admin.firestore.FieldValue.arrayUnion(uid),
        [`users.${uid}`]: {
          role: "contributor",
          name: displayName,
          avatarUrl: photoURL,
        },
      });

      transaction.update(userRef, {
        workspaceIds: admin.firestore.FieldValue.arrayUnion(
          inviteData.workspaceId
        ),
      });

      transaction.delete(inviteDoc.ref);
    });

    return { success: true, workspaceId: inviteData.workspaceId };
  } catch (error: any) {
    console.error("Error in joinWorkspace transaction:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      "An unexpected error occurred while trying to join the workspace."
    );
  }
});
