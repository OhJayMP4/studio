'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useFirestore, setDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export function InviteUserDialog({ children, workspaceId }: { children: React.ReactNode, workspaceId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "contributor" | "viewer">("viewer");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !role) return;

    // This is a simplification. In a real app, you would use a Cloud Function
    // to look up the user by email, get their UID, and then add them.
    // For now, we'll use a placeholder UID based on the email.
    const placeholderUserId = email.replace(/[^a-zA-Z0-9]/g, '');

    const userRef = doc(firestore, `workspaces/${workspaceId}/users/${placeholderUserId}`);
    
    setDocumentNonBlocking(userRef, {
        userId: placeholderUserId, // This is a placeholder
        email: email,
        name: email, // Placeholder name
        avatarUrl: '', // Placeholder avatar
        role: role,
    }, { merge: true });

    toast({
        title: "User Invited",
        description: `${email} has been invited to the workspace.`,
    });
    
    setOpen(false);
    setEmail("");
    setRole("viewer");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-headline">Invite User</DialogTitle>
            <DialogDescription>
              Invite a new user to collaborate in this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select onValueChange={(value: "admin" | "contributor" | "viewer") => setRole(value)} defaultValue={role} required>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="contributor">Contributor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Send Invitation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
