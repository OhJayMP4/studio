'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useFirebase } from "@/firebase";

// Basic email validation
const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function InviteMemberButton() {
    const { selectedWorkspace } = useSelectedWorkspace();
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
            const functions = getFunctions(firebaseApp);
            const createInvite = httpsCallable(functions, 'createInvite');
            
            const result = await createInvite({ 
                workspaceId: selectedWorkspace.id, 
                email: email 
            });

            const data = result.data as { success: boolean, token?: string, error?: string };

            if (data.success && data.token) {
                 const appUrl = process.env.NEXT_PUBLIC_APP_URL;
                 if (!appUrl) {
                    console.error('FATAL: NEXT_PUBLIC_APP_URL is not defined.');
                    toast({
                        variant: 'destructive',
                        title: "Configuration Error",
                        description: "The application URL is not configured. The invite was created but the email could not be sent.",
                    });
                    return;
                }
                 const joinUrl = `${appUrl}/join?token=${data.token}`;

                // The email is now sent by the Cloud Function.
                 toast({
                    title: "Invitation Sent!",
                    description: `An invitation email has been sent to ${email}.`,
                });

            } else {
                throw new Error(data.error || "An unknown error occurred in the createInvite function.");
            }
            
        } catch(error: any) {
            console.error("Error creating invite:", error);
            toast({
                variant: 'destructive',
                title: "Failed to Send Invite",
                description: error.message || "An unknown error occurred.",
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
