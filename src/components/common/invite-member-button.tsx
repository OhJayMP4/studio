'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import { useUser } from "@/firebase";

// Basic email validation
const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function InviteMemberButton() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user } = useUser();
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
                title: "Sending Invitation...",
                description: `Sending invite to ${email}.`,
            });
            
            const idToken = await user.getIdToken();
            const functionsUrl = `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/createInvite`;

            const response = await fetch(functionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    workspaceId: selectedWorkspace.id,
                    email: email,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Request failed with status ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                 toast({
                    title: "Invitation Sent!",
                    description: `An invitation email has been sent to ${email}.`,
                });
            } else {
                throw new Error(result.error || "An unknown error occurred in the createInvite function.");
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
