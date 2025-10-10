'use client';

import { useState } from 'react';
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
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().min(1, 'Project name is required.'),
  deadline: z.date({ required_error: 'A deadline is required.' }),
  hasMonetaryValue: z.boolean().default(false),
  monetaryValue: z.preprocess(
    (a) => (a === '' ? undefined : parseFloat(z.string().parse(a))),
    z.number().positive().optional()
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

interface AddProjectDialogProps {
  companyId: string;
  children?: React.ReactNode;
}

export function AddProjectDialog({ companyId, children }: AddProjectDialogProps) {
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
    defaultValues: {
        hasMonetaryValue: false,
    }
  });

  const hasMonetaryValue = watch('hasMonetaryValue');

  const handleCreateProject = async (data: FormValues) => {
    if (!selectedWorkspace) {
      toast({
        variant: 'destructive',
        title: 'Workspace Error',
        description: 'You must select a workspace to add a project.',
      });
      return;
    }

    try {
      const projectsCollection = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects');
      await addDoc(projectsCollection, {
        name: data.name,
        deadline: data.deadline.toISOString(),
        hasMonetaryValue: data.hasMonetaryValue,
        monetaryValue: data.hasMonetaryValue ? data.monetaryValue : null,
        progress: Math.floor(Math.random() * 101), // Random progress for now
      });
      
      toast({
        title: 'Project Created',
        description: `The "${data.name}" project has been successfully created.`,
      });
      reset({ hasMonetaryValue: false, name: '', deadline: undefined, monetaryValue: undefined });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Could not create the project.',
      });
    }
  };
  
  const trigger = children ? (
    <DialogTrigger asChild>{children}</DialogTrigger>
  ) : (
    <DialogTrigger asChild>
      <Button>
        <PlusCircle className="mr-2" />
        Add Project
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleCreateProject)}>
          <DialogHeader>
            <DialogTitle>Add a new project</DialogTitle>
            <DialogDescription>
              Fill in the details for the new project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="e.g. Website Redesign"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <Controller
              name="deadline"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    {errors.deadline && (
                        <p className="text-sm text-destructive mt-1">{errors.deadline.message}</p>
                    )}
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
                    <Switch
                        id="hasMonetaryValue"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                    />
                )}
              />
            </div>
             {errors.hasMonetaryValue && (
                <p className="text-sm text-destructive mt-1">{errors.hasMonetaryValue.message}</p>
            )}

            {hasMonetaryValue && (
              <div className="space-y-2">
                <Label htmlFor="monetaryValue">Monetary Value ($)</Label>
                <Input
                  id="monetaryValue"
                  type="number"
                  placeholder="e.g. 50000"
                  {...register('monetaryValue')}
                />
                {errors.monetaryValue && (
                  <p className="text-sm text-destructive mt-1">{errors.monetaryValue.message}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}