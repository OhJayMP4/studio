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
import { addDoc, collection, doc, getDocs, runTransaction, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Project, Silo, Task } from '@/lib/types';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  date: z.date({ required_error: 'A sale date is required.' }),
  source: z.string().min(1, 'Sale source is required.'),
  value: z.preprocess(
    (a) => (a === '' || a === undefined ? undefined : parseFloat(String(a))),
    z.number().positive('Sale value must be a positive number.')
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface AddSaleDialogProps {
  project: Project;
  companyId: string;
  children?: React.ReactNode;
}

// Function to calculate task-based progress
async function calculateTaskProgress(firestore: any, workspaceId: string, companyId: string, projectId: string) {
    const silosCollection = collection(firestore, 'workspaces', workspaceId, 'companies', companyId, 'projects', projectId, 'silos');
    const silosSnapshot = await getDocs(silosCollection);
    let totalTasks = 0;
    let completedTasks = 0;

    for (const siloDoc of silosSnapshot.docs) {
        const tasksCollection = collection(siloDoc.ref, 'tasks');
        const tasksSnapshot = await getDocs(tasksCollection);
        totalTasks += tasksSnapshot.size;
        tasksSnapshot.forEach(taskDoc => {
            if (taskDoc.data().completed) {
                completedTasks++;
            }
        });
    }

    return totalTasks > 0 ? (completedTasks / totalTasks) : 0;
}


export function AddSaleDialog({ project, companyId, children }: AddSaleDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const handleLogSale = async (data: FormValues) => {
    if (!selectedWorkspace) {
      toast({
        variant: 'destructive',
        title: 'Workspace Error',
        description: 'A workspace must be selected to log a sale.',
      });
      return;
    }

    const projectRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', project.id);
    const salesCollection = collection(projectRef, 'sales');

    try {
        await runTransaction(firestore, async (transaction) => {
            const currentProjectDoc = await transaction.get(projectRef);
            if (!currentProjectDoc.exists()) {
                throw new Error("Project does not exist!");
            }
            const currentProjectData = currentProjectDoc.data() as Project;

            // 1. Add the new sale document
            const newSaleRef = doc(salesCollection);
            transaction.set(newSaleRef, {
                date: data.date.toISOString(),
                source: data.source,
                value: data.value,
                projectId: project.id,
            });

            // 2. Calculate new total sales value
            const newTotalSales = (currentProjectData.totalSalesValue || 0) + data.value;

            // 3. Recalculate overall progress
            const salesTarget = currentProjectData.monetaryValue || 0;
            const salesProgress = salesTarget > 0 ? Math.min(newTotalSales / salesTarget, 1) : 0;
            
            const taskProgress = await calculateTaskProgress(firestore, selectedWorkspace.id, companyId, project.id);

            const overallProgress = (salesProgress * 0.5 + taskProgress * 0.5) * 100;

            // 4. Update the project document
            transaction.update(projectRef, { 
                totalSalesValue: newTotalSales,
                progress: Math.round(overallProgress)
            });
        });

      toast({
        title: 'Sale Logged',
        description: `A sale of ZAR ${data.value.toLocaleString()} has been logged.`,
      });
      reset();
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error logging sale:', error);
      toast({
        variant: 'destructive',
        title: 'Logging Failed',
        description: error.message || 'Could not log the sale.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
       <DialogTrigger asChild>
          {children || <Button><PlusCircle className="mr-2 h-4 w-4" /> Log Sale</Button>}
        </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleLogSale)}>
          <DialogHeader>
            <DialogTitle>Log a New Sale</DialogTitle>
            <DialogDescription>
              Record a sale for the "{project.name}" project. Currency is in ZAR.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Sale Value (ZAR)</Label>
              <Input
                id="value"
                type="number"
                placeholder="e.g. 15000"
                {...register('value')}
              />
              {errors.value && (
                <p className="text-sm text-destructive mt-1">{errors.value.message}</p>
              )}
            </div>
            
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                    <Label>Date of Sale</Label>
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
                    {errors.date && (
                        <p className="text-sm text-destructive mt-1">{errors.date.message}</p>
                    )}
                </div>
              )}
            />

            <div className="space-y-2">
              <Label>Source of Sale</Label>
              <Textarea
                id="source"
                placeholder="e.g. Referral from Acme Inc., Cold call"
                {...register('source')}
              />
              {errors.source && (
                <p className="text-sm text-destructive mt-1">{errors.source.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Logging...' : 'Log Sale'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
