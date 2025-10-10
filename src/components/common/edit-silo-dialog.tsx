'use client';

import { useState, useEffect } from 'react';
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
import { useFirestore } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Silo } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(1, 'Silo name is required.'),
});

type FormValues = z.infer<typeof formSchema>;

interface EditSiloDialogProps {
  silo: Silo;
  companyId: string;
  projectId: string;
  children: React.ReactNode;
}

export function EditSiloDialog({ silo, companyId, projectId, children }: EditSiloDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: silo.name,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ name: silo.name });
    }
  }, [isOpen, silo, reset]);

  const handleUpdateSilo = async (data: FormValues) => {
    if (!selectedWorkspace) return;

    try {
      const siloRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', silo.id);
      await updateDoc(siloRef, data);
      
      toast({
        title: 'Silo Updated',
        description: `The silo has been renamed to "${data.name}".`,
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error updating silo:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update the silo.',
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleUpdateSilo)}>
          <DialogHeader>
            <DialogTitle>Edit Silo</DialogTitle>
            <DialogDescription>
              Rename the "{silo.name}" silo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Silo Name</Label>
              <Input
                id="name"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
