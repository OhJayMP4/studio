'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Button } from "@/components/ui/button";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { UserPlus } from "lucide-react";

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

        try {
            const token = generateToken();
            const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now

            await addDoc(collection(firestore, 'invites'), {
                workspaceId: selectedWorkspace.id,
                email,
                token,
                expires,
            });
            
            toast({
                title: "Invitation Sent!",
                description: `An invitation has been generated for ${email}. You need to manually send them the link. NOTE: Email sending is not yet implemented.`,
            });
            
            // In a real app, an email would be sent here via a backend function.
            // For now, we can log the link to the console for testing.
            const joinUrl = `${window.location.origin}/join?token=${token}`;
            console.log(`Generated invite link for ${email}: ${joinUrl}`);


        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: "Failed to Send Invite",
                description: error.message,
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
