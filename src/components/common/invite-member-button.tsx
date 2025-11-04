'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import { useUser, useFirebase } from "@/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { sendInviteEmail } from "@/ai/flows/send-invite-email-flow";

// Basic email validation
const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function InviteMemberButton() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user } = useUser();
    const { toast } = useToast();
    const { firebaseApp } = useFirebase();

    const handleInvite = async () => {
        if (!selectedWorkspace) {
            toast({
                variant: 'destructive',
                title: "No workspace selected",
                description: "Please select a workspace before inviting members."
            });
            return;
        }
        if (!user) {
             toast({
                variant: 'destructive',
                title: "Not authenticated",
                description: "You must be logged in to send invites."
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
        
        try {
            toast({
                title: "Creating Invitation...",
                description: `Sending invite to ${email}.`,
            });
            
            const functions = getFunctions(firebaseApp);
            const createInvite = httpsCallable(functions, 'createInvite');
            
            const result = await createInvite({
                workspaceId: selectedWorkspace.id,
                email: email,
            });

            const data = result.data as { success: boolean, joinUrl?: string, workspaceName?: string };

            if (data.success && data.joinUrl && data.workspaceName) {
                 toast({
                    title: "Invitation Created!",
                    description: `Now sending email...`,
                });

                // Now call the Genkit flow to send the email
                const emailResult = await sendInviteEmail({
                    email,
                    workspaceName: data.workspaceName,
                    joinUrl: data.joinUrl,
                });

                if (emailResult.success) {
                    toast({
                        title: "Invitation Sent!",
                        description: `An invitation has been sent to ${email}.`,
                    });
                } else {
                     toast({
                        variant: 'destructive',
                        title: "Email Failed to Send",
                        description: `The invite was created, but the email could not be sent. You can share this link manually: ${data.joinUrl}`,
                    });
                }

            } else {
                throw new Error("The createInvite function failed to return the necessary data.");
            }
            
        } catch(error: any) {
            console.error("Error creating invite:", error);
            const message = error.message || "An unknown error occurred.";
            toast({
                variant: 'destructive',
                title: "Failed to Send Invite",
                description: message,
            });
        }
    };

    return (
        <Button onClick={handleInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
        </Button>
    )
}
