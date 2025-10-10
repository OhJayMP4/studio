'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Workspace name is required.'),
});

type FormValues = z.infer<typeof formSchema>;

export function AddWorkspaceDialog({ children }: { children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const handleCreateWorkspace = async (data: FormValues) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to create a workspace.',
      });
      return;
    }

    try {
      await addDoc(collection(firestore, 'workspaces'), {
        name: data.name,
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
      
      toast({
        title: 'Workspace Created',
        description: `The "${data.name}" workspace has been successfully created.`,
      });
      reset();
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Could not create the workspace.',
      });
    }
  };
  
  const trigger = children ? (
    <DialogTrigger asChild>{children}</DialogTrigger>
  ) : (
    <DialogTrigger asChild>
      <Button>
        <PlusCircle className="mr-2" />
        Create Workspace
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleCreateWorkspace)}>
          <DialogHeader>
            <DialogTitle>Create a new workspace</DialogTitle>
            <DialogDescription>
              A workspace is where you'll collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <div className="col-span-3">
                <Input
                  id="name"
                  placeholder="e.g. Marketing Team"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
