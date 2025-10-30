'use server';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Resend } from "resend";

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();


// Generate a simple random token
const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

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
    const existingUser = Object.values(workspaceData?.users || {}).find((member: any) => member.email === email);
    if(existingUser) {
        throw new functions.https.HttpsError('already-exists', 'A user with this email is already a member of the workspace.');
    }
    
    // 3. Create Invite in Firestore
    const token = generateToken();
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours in millis

    const inviteRef = db.collection('invites').doc();
    await inviteRef.set({
        workspaceId,
        email,
        token,
        expires, 
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Send Email via Resend
    const resendApiKey = functions.config().resend?.api_key || process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        console.warn('RESEND_API_KEY not set. Cannot send invitation email.');
        // Still return success, as the invite is created.
        return { success: true, message: "Invite created, but email not sent due to missing API key." };
    }

    const appUrl = functions.config().app?.url || process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
        console.error('NEXT_PUBLIC_APP_URL not set. Cannot form join URL for email.');
        return { success: true, message: "Invite created, but email not sent due to missing App URL." };
    }
    
    const joinUrl = `${appUrl}/join?token=${token}`;
    const resend = new Resend(resendApiKey);

    try {
        await resend.emails.send({
            from: 'onboarding@saturnsync.com',
            to: email,
            subject: `You're invited to join the "${workspaceData?.name}" workspace on SaturnSync!`,
            html: `
              <div style="font-family: sans-serif; text-align: center; padding: 40px;">
                <h1 style="font-size: 24px;">You're Invited!</h1>
                <p style="font-size: 16px; color: #555;">You have been invited to join the <strong>${workspaceData?.name}</strong> workspace on SaturnSync.</p>
                <a 
                  href="${joinUrl}" 
                  target="_blank"
                  style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;"
                >
                  Join Workspace
                </a>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">
                  If you did not expect this invitation, you can ignore this email.
                </p>
              </div>
            `,
        });
         return { success: true };
    } catch (error) {
        console.error('Error sending email via Resend:', error);
        // Throw an internal error that the client can catch
        throw new functions.https.HttpsError('internal', 'Failed to send invitation email.');
    }
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

    if (inviteData.email !== email) {
        throw new functions.https.https.HttpsError('permission-denied', 'This invitation is not intended for your account.');
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
          workspaceIds: admin.firestore.FieldValue.arrayUnion(workspaceId),
        });

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
    const bucket = storage.bucket();
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

    } catch (error) {
        console.error("Error moving file or updating Firestore:", error);
        throw new functions.https.HttpsError('internal', 'Failed to finalize workspace logo.');
    }
});
