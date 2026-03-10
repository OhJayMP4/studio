
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
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import type { Company } from '@/lib/types';

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

interface EditCompanyDialogProps {
  company: Company;
  children: React.ReactNode;
}

export function EditCompanyDialog({ company, children }: EditCompanyDialogProps) {
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
      name: company.name,
      description: company.description,
      logoUrl: company.logoUrl,
      yearlyTurnoverTarget: company.yearlyTurnoverTarget,
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: company.name,
        description: company.description,
        logoUrl: company.logoUrl,
        yearlyTurnoverTarget: company.yearlyTurnoverTarget,
      });
    }
  }, [isOpen, company, reset]);

  const handleUpdateCompany = async (data: FormValues) => {
    if (!selectedWorkspace) return;

    try {
      const companyRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', company.id);
      await updateDoc(companyRef, {
        ...data,
        logoUrl: data.logoUrl || null,
        yearlyTurnoverTarget: data.yearlyTurnoverTarget || null,
        updatedAt: serverTimestamp(),
      });
      
      toast({
        title: 'Company Updated',
        description: `The "${data.name}" company has been successfully updated.`,
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error updating company:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update the company.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleUpdateCompany)}>
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update the details for the "{company.name}" company.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} />
              {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" {...register('logoUrl')} />
              {errors.logoUrl && <p className="text-sm text-destructive mt-1">{errors.logoUrl.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearlyTurnoverTarget">Yearly Turnover Target (R)</Label>
              <Input id="yearlyTurnoverTarget" type="number" {...register('yearlyTurnoverTarget')} />
              {errors.yearlyTurnoverTarget && <p className="text-sm text-destructive mt-1">{errors.yearlyTurnoverTarget.message}</p>}
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
