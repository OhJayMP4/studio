'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { CalendarIcon } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(1, 'Project name is required.'),
  deadline: z.date({ required_error: 'A deadline is required.' }),
  hasMonetaryValue: z.boolean().default(false),
  monetaryValue: z.preprocess(
    (a) => (a === '' || a === undefined ? undefined : parseFloat(String(a))),
    z.number().positive('Value must be a positive number.').optional()
  ),
}).refine(data => {
    if (data.hasMonetaryValue) {
        return data.monetaryValue !== undefined && data.monetaryValue > 0;
    }
    return true;
}, {
    message: 'Monetary value is required when the toggle is on.',
    path: ['monetaryValue'],
});

type FormValues = z.infer<typeof formSchema>;

interface EditProjectDialogProps {
  project: Project;
  companyId: string;
  children: React.ReactNode;
}

export function EditProjectDialog({ project, companyId, children }: EditProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const hasMonetaryValue = watch('hasMonetaryValue');

  useEffect(() => {
    if (isOpen) {
      reset({
        name: project.name,
        deadline: new Date(project.deadline),
        hasMonetaryValue: project.hasMonetaryValue,
        monetaryValue: project.monetaryValue,
      });
    }
  }, [isOpen, project, reset]);

  const handleUpdateProject = async (data: FormValues) => {
    if (!selectedWorkspace) return;

    try {
      const projectRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', project.id);
      await updateDoc(projectRef, {
        name: data.name,
        deadline: data.deadline.toISOString(),
        hasMonetaryValue: data.hasMonetaryValue,
        monetaryValue: data.hasMonetaryValue ? data.monetaryValue : null,
      });
      
      toast({
        title: 'Project Updated',
        description: `The "${data.name}" project has been successfully updated.`,
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update the project.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleUpdateProject)}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the details for "{project.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <Controller
              name="deadline"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                    <Label>Deadline</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal",!field.value && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    {errors.deadline && <p className="text-sm text-destructive mt-1">{errors.deadline.message}</p>}
                </div>
              )}
            />

            <div className="flex items-center justify-between space-y-2">
                <div className='space-y-0.5'>
                    <Label htmlFor="hasMonetaryValue">Has Monetary Value?</Label>
                    <p className='text-xs text-muted-foreground'>Does this project have a budget or contract value?</p>
                </div>
              <Controller
                name="hasMonetaryValue"
                control={control}
                render={({ field }) => (
                    <Switch id="hasMonetaryValue" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
             {errors.hasMonetaryValue && <p className="text-sm text-destructive mt-1">{errors.hasMonetaryValue.message}</p>}

            {hasMonetaryValue && (
              <div className="space-y-2">
                <Label htmlFor="monetaryValue">Monetary Value (ZAR)</Label>
                <Input id="monetaryValue" type="number" {...register('monetaryValue')} />
                {errors.monetaryValue && <p className="text-sm text-destructive mt-1">{errors.monetaryValue.message}</p>}
              </div>
            )}
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
