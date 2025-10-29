import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cors from "cors";

const corsHandler = cors({ origin: true });

admin.initializeApp();
const db = admin.firestore();

export const joinWorkspace = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    // Manually verify the Firebase Auth token.
    const idToken = request.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      response.status(401).send('Unauthorized');
      return;
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      functions.logger.error("Error verifying token:", error);
      response.status(401).send('Unauthorized: Invalid token');
      return;
    }
    
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const displayName = decodedToken.name || email;
    const photoURL = decodedToken.picture || null;
    
    const { token } = request.body.data;
    if (!token || typeof token !== "string") {
       response.status(400).send({ error: { message: "A valid invitation token must be provided." }});
       return;
    }

    const invitesRef = db.collection("invites");
    
    try {
      const inviteQuery = await invitesRef
        .where("token", "==", token)
        .where("email", "==", email)
        .limit(1)
        .get();

      if (inviteQuery.empty) {
        response.status(404).send({ error: { message: "This invitation is invalid, expired, or not intended for you." }});
        return;
      }

      const inviteDoc = inviteQuery.docs[0];
      const inviteData = inviteDoc.data();

      if (inviteData.expires < Date.now()) {
        await inviteDoc.ref.delete();
        response.status(410).send({ error: { message: "This invitation has expired." }});
        return;
      }

      const workspaceRef = db.doc(`workspaces/${inviteData.workspaceId}`);
      const userRef = db.doc(`users/${uid}`);

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

      response.status(200).send({ data: { success: true, workspaceId: inviteData.workspaceId } });

    } catch (error: any) {
      console.error("Error in joinWorkspace function:", error);
      if (error.code && error.details) { // Check if it's an HttpsError
        response.status(500).send({ error: { message: error.details }});
      } else {
        response.status(500).send({ error: { message: "An unexpected error occurred while trying to join the workspace." }});
      }
    }
  });
});
