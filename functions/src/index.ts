import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cors from "cors";

const corsHandler = cors({ origin: true });

admin.initializeApp();
const db = admin.firestore();

export const joinWorkspace = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).json({ error: { message: 'Method Not Allowed' }});
        return;
      }

      const idToken = request.headers.authorization?.split('Bearer ')[1];
      if (!idToken) {
        response.status(401).json({ error: { message: "Unauthorized: No token provided." }});
        return;
      }

      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;
      const displayName = decodedToken.name || email;
      const photoURL = decodedToken.picture || null;

      const { token } = request.body;
      if (!token || typeof token !== "string") {
        response.status(400).json({ error: { message: "A valid invitation token must be provided." }});
        return;
      }

      const invitesRef = db.collection("invites");
      const inviteQuery = await invitesRef.where("token", "==", token).limit(1).get();

      if (inviteQuery.empty) {
        response.status(404).json({ error: { message: "This invitation is invalid or has already been used." }});
        return;
      }

      const inviteDoc = inviteQuery.docs[0];
      const inviteData = inviteDoc.data();

      // Validate the invite is for the correct user
      if (inviteData.email !== email) {
        response.status(403).json({ error: { message: "This invitation is not intended for your account." }});
        return;
      }

      if (inviteData.expires < Date.now()) {
        await inviteDoc.ref.delete();
        response.status(410).json({ error: { message: "This invitation has expired." }});
        return;
      }

      const workspaceRef = db.doc(`workspaces/${inviteData.workspaceId}`);
      const userRef = db.doc(`users/${uid}`);

      await db.runTransaction(async (transaction) => {
        const workspaceDoc = await transaction.get(workspaceRef);

        if (!workspaceDoc.exists) {
          throw new functions.https.HttpsError("not-found", "The workspace you were invited to no longer exists.");
        }

        const workspaceData = workspaceDoc.data();
        if (workspaceData?.memberIds?.includes(uid)) {
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
          workspaceIds: admin.firestore.FieldValue.arrayUnion(inviteData.workspaceId),
        });

        transaction.delete(inviteDoc.ref);
      });

      response.status(200).json({ data: { success: true, workspaceId: inviteData.workspaceId } });

    } catch (error: any) {
      functions.logger.error("Error in joinWorkspace function:", error);
      if (error instanceof functions.https.HttpsError) {
        response.status(500).json({ error: { message: error.message }});
      } else if (error.code === 'auth/id-token-expired') {
        response.status(401).json({ error: { message: 'Authentication token has expired. Please sign in again.' }});
      }
      else {
        response.status(500).json({ error: { message: "An unexpected internal error occurred." }});
      }
    }
  });
});
