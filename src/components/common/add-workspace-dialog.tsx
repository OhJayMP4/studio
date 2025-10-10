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
import React, { useState, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, addDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";

interface AddWorkspaceDialogProps {
  children: ReactNode;
}

export function AddWorkspaceDialog({ children }: AddWorkspaceDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspaceName || !user) return;

    const workspacesCol = collection(firestore, 'workspaces');
    
    // The initial user object to be stored in the workspace
    const workspaceUserData = {
      role: 'admin',
      name: user.displayName || user.email || "Owner",
      email: user.email,
      avatarUrl: user.photoURL
    };

    // Create the main workspace document
    const newWorkspaceRefPromise = addDocumentNonBlocking(workspacesCol, {
      name: workspaceName,
      ownerId: user.uid,
      // We will now store a map of users directly on the workspace document
      // to simplify initial creation and rules.
      users: {
        [user.uid]: workspaceUserData
      }
    });

    // We can also create the user document in the subcollection for more detailed profiles later.
    newWorkspaceRefPromise.then(newWorkspaceRef => {
        if (newWorkspaceRef) {
            const userSubcollectionRef = doc(firestore, `workspaces/${newWorkspaceRef.id}/users/${user.uid}`);
            setDocumentNonBlocking(userSubcollectionRef, {
                userId: user.uid,
                ...workspaceUserData
            }, { merge: true });
        }
    });

    toast({
        title: "Workspace Created",
        description: "The new workspace has been successfully created.",
    });
    
    setOpen(false);
    setWorkspaceName("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-headline">Create New Workspace</DialogTitle>
            <DialogDescription>
              A workspace is where your teams and projects live.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="E.g. Marketing Team"
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Create Workspace</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
