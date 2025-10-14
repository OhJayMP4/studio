'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Button } from "@/components/ui/button";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { addDoc, collection } from "firebase/firestore";
import { UserPlus } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { sendInviteEmail } from "@/ai/flows/send-invite-email-flow";

// Basic email validation
const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Generate a simple random token
const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function InviteMemberButton() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleInvite = async () => {
        if (!selectedWorkspace) {
            toast({
                variant: 'destructive',
                title: "No workspace selected",
                description: "Please select a workspace before inviting members."
            });
            return;
        }

        const email = prompt("Enter the email address of the person you want to invite:");

        if (!email) {
            return; // User cancelled the prompt
        }

        if (!validateEmail(email)) {
            toast({
                variant: 'destructive',
                title: "Invalid Email",
                description: "Please enter a valid email address."
            });
            return;
        }

        const token = generateToken();
        const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now

        const inviteData = {
            workspaceId: selectedWorkspace.id,
            email,
            token,
            expires,
        };

        const invitesCollection = collection(firestore, 'invites');

        try {
            await addDoc(invitesCollection, inviteData);

            const appUrl = process.env.NEXT_PUBLIC_APP_URL;
            console.log('APP_URL from env:', appUrl); // Log for debug
            
            if (!appUrl) {
                console.error('FATAL: NEXT_PUBLIC_APP_URL is not defined in the environment. Cannot send invitation email.');
                toast({
                    variant: 'destructive',
                    title: "Configuration Error",
                    description: "The application URL is not configured. Please contact support.",
                });
                return;
            }
            const joinUrl = `${appUrl}/join?token=${token}`;
            console.log('Generated join URL:', joinUrl);

            // Call the Genkit flow to send the email
            const result = await sendInviteEmail({
                email: email,
                workspaceName: selectedWorkspace.name,
                joinUrl: joinUrl
            });

            if (result.success) {
                toast({
                    title: "Invitation Sent!",
                    description: `An invitation email has been sent to ${email}.`,
                });
            } else {
                 toast({
                    variant: 'destructive',
                    title: "Email Failed to Send",
                    description: "The invite was created, but the email could not be sent. Please check your Resend configuration.",
                });
            }
            
        } catch(error: any) {
             if (error instanceof FirestorePermissionError || (error.name === 'FirebaseError' && error.code === 'permission-denied')) {
                 const permissionError = new FirestorePermissionError({
                    path: invitesCollection.path,
                    operation: 'create',
                    requestResourceData: inviteData,
                });
                errorEmitter.emit('permission-error', permissionError);
             } else {
                 toast({
                    variant: 'destructive',
                    title: "Failed to Send Invite",
                    description: error.message || "An unknown error occurred.",
                });
             }
        }
    };

    return (
        <Button onClick={handleInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
        </Button>
    )
}
