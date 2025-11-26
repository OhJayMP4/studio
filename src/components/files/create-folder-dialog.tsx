
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirebase } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FolderPlus } from 'lucide-react';

interface CreateFolderDialogProps {
  currentPath: string;
}

export function CreateFolderDialog({ currentPath }: CreateFolderDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { firebaseApp } = useFirebase();

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast({ variant: 'destructive', title: 'Folder name cannot be empty.' });
      return;
    }
    if (!selectedWorkspace || !firebaseApp) {
      toast({ variant: 'destructive', title: 'Workspace not selected or app not initialized.' });
      return;
    }
    
    setIsLoading(true);
    try {
      const functions = getFunctions(firebaseApp, 'us-central1');
      const createFolderFn = httpsCallable(functions, 'createFolder');
      await createFolderFn({
        workspaceId: selectedWorkspace.id,
        parentPath: currentPath,
        folderName: folderName.trim(),
      });

      toast({ title: 'Folder Created', description: `Folder "${folderName.trim()}" has been created.` });
      setFolderName('');
      setIsOpen(false);
    } catch (error: any) {
      console.error("Error creating folder: ", error);
      toast({ variant: 'destructive', title: 'Failed to create folder', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderPlus className="h-4 w-4 mr-2" />
          Create Folder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Enter a name for your new folder.
            {currentPath && <p className="text-sm mt-1">It will be created inside: <span className="font-mono text-foreground bg-muted p-1 rounded-sm">{currentPath}</span></p>}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="folder-name">Folder Name</Label>
          <Input
            id="folder-name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="e.g. Project Documents"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateFolder} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Folder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
