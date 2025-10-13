'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface AddWorkspaceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddWorkspaceDialog({ open, onOpenChange }: AddWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('DIALOG SUBMIT CLICKED', new Date().toISOString(), 'Name:', name);
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to create a workspace.',
      });
      return;
    }
    if (!name.trim()) {
        toast({
            variant: 'destructive',
            title: 'Validation Error',
            description: 'Workspace name is required.',
        });
        return;
    }

    setIsSubmitting(true);
    try {
      // Create the workspace document
      const workspaceRef = await addDoc(collection(firestore, 'workspaces'), {
        name: name,
        ownerId: user.uid,
        memberIds: [user.uid],
        users: {
          [user.uid]: {
            role: 'admin',
            name: user.displayName,
            avatarUrl: user.photoURL,
          },
        },
      });
      console.log('addDoc done, wsRef.id:', workspaceRef.id);

      // Also update the user's document with the new workspace ID
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        workspaceIds: arrayUnion(workspaceRef.id),
      });
       console.log('updateDoc done for user:', user.uid);
      
      toast({
        title: 'Workspace Created',
        description: `The "${name}" workspace has been successfully created.`,
      });
      setName('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('CREATE DIALOG ERROR:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Could not create the workspace.',
      });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleCreateWorkspace}>
          <DialogHeader>
            <DialogTitle>Create a new workspace</DialogTitle>
            <DialogDescription>
              A workspace is where you'll collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                placeholder="e.g. Marketing Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
