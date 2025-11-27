
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
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Silo name is required.'),
});

type FormValues = z.infer<typeof formSchema>;

interface AddSiloDialogProps {
  companyId: string;
  projectId: string;
  children?: React.ReactNode;
}

export function AddSiloDialog({ companyId, projectId, children }: AddSiloDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const handleCreateSilo = async (data: FormValues) => {
    if (!selectedWorkspace || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must select a workspace and be logged in to add a silo.',
      });
      return;
    }

    try {
      const silosCollection = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos');
      
      // Get current number of silos to determine the order
      const existingSilos = await getDocs(silosCollection);
      const order = existingSilos.size;

      await addDoc(silosCollection, {
        name: data.name,
        order: order,
        createdBy: user.uid,
        workspaceId: selectedWorkspace.id,
      });
      
      toast({
        title: 'Silo Created',
        description: `The "${data.name}" silo has been successfully created.`,
      });
      reset();
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error creating silo:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Could not create the silo.',
      });
    }
  };
  
  const trigger = children ? (
    <DialogTrigger asChild onClick={() => setIsOpen(true)}>{children}</DialogTrigger>
  ) : (
    <DialogTrigger asChild onClick={() => setIsOpen(true)}>
      <Button>
        <PlusCircle className="mr-2" />
        Add Silo
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleCreateSilo)}>
          <DialogHeader>
            <DialogTitle>Add a new silo</DialogTitle>
            <DialogDescription>
              A silo helps organize tasks within your project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Silo Name</Label>
              <Input
                id="name"
                placeholder="e.g. To Do, In Progress, Done"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Silo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
