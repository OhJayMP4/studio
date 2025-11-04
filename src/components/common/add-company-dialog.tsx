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
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  name: z.string().min(1, 'Company name is required.'),
  description: z.string().min(1, 'Description is required.'),
  logoUrl: z.string().url().optional().or(z.literal('')),
  yearlyTurnoverTarget: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive().optional()
  ),
});

type FormValues = z.infer<typeof formSchema>;

export function AddCompanyDialog({ children }: { children?: React.ReactNode }) {
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

  const handleCreateCompany = async (data: FormValues) => {
    if (!selectedWorkspace || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must select a workspace and be logged in to add a company.',
      });
      return;
    }

    try {
      const companiesCollection = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
      await addDoc(companiesCollection, {
        name: data.name,
        description: data.description,
        logoUrl: data.logoUrl || null,
        yearlyTurnoverTarget: data.yearlyTurnoverTarget || null,
        workspaceId: selectedWorkspace.id,
        createdBy: user.uid,
      });
      
      toast({
        title: 'Company Created',
        description: `The "${data.name}" company has been successfully created.`,
      });
      reset();
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Could not create the company.',
      });
    }
  };
  
  const trigger = children ? (
    <DialogTrigger asChild onClick={() => setIsOpen(true)}>{children}</DialogTrigger>
  ) : (
    <DialogTrigger asChild onClick={() => setIsOpen(true)}>
      <Button>
        <PlusCircle className="mr-2" />
        Add Company
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleCreateCompany)}>
          <DialogHeader>
            <DialogTitle>Add a new company</DialogTitle>
            <DialogDescription>
              Fill in the details for the new company in your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                placeholder="e.g. Acme Inc."
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What does this company do?"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                {...register('logoUrl')}
              />
              {errors.logoUrl && (
                <p className="text-sm text-destructive mt-1">{errors.logoUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearlyTurnoverTarget">Yearly Turnover Target (R)</Label>
              <Input
                id="yearlyTurnoverTarget"
                type="number"
                placeholder="e.g. 1000000"
                {...register('yearlyTurnoverTarget')}
              />
              {errors.yearlyTurnoverTarget && (
                <p className="text-sm text-destructive mt-1">{errors.yearlyTurnoverTarget.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Company'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
