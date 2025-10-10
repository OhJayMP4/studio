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
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Workspace } from '@/lib/types';

const formSchema = z.object({
  title: z.string().min(1, 'Task title is required.'),
  dueDate: z.date({ required_error: 'A due date is required.' }),
  priority: z.enum(['low', 'medium', 'high'], {
    required_error: 'Priority is required.',
  }),
  assigneeId: z.string({ required_error: 'An assignee is required.' }),
});

type FormValues = z.infer<typeof formSchema>;

interface AddTaskDialogProps {
  companyId: string;
  projectId: string;
  siloId: string;
  children?: React.ReactNode;
}

const getWorkspaceUsers = (workspace: Workspace | null) => {
    if (!workspace) return [];
    return Object.entries(workspace.users).map(([uid, userData]) => ({
        id: uid,
        ...userData
    }));
}

export function AddTaskDialog({ companyId, projectId, siloId, children }: AddTaskDialogProps) {
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
  
  const workspaceUsers = getWorkspaceUsers(selectedWorkspace);

  const handleCreateTask = async (data: FormValues) => {
    if (!selectedWorkspace) {
      toast({
        variant: 'destructive',
        title: 'Workspace Error',
        description: 'A workspace must be selected to add a task.',
      });
      return;
    }

    try {
      const tasksCollection = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', companyId, 'projects', projectId, 'silos', siloId, 'tasks');
      await addDoc(tasksCollection, {
        title: data.title,
        dueDate: data.dueDate.toISOString(),
        priority: data.priority,
        assigneeId: data.assigneeId,
        completed: false,
      });
      
      toast({
        title: 'Task Created',
        description: `The "${data.title}" task has been successfully created.`,
      });
      reset();
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Could not create the task.',
      });
    }
  };
  
  const trigger = children ? (
    <DialogTrigger asChild onClick={() => setIsOpen(true)}>{children}</DialogTrigger>
  ) : (
    <DialogTrigger asChild onClick={() => setIsOpen(true)}>
      <Button variant="ghost" size="sm">
        <PlusCircle className="mr-2" />
        Add Task
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleCreateTask)}>
          <DialogHeader>
            <DialogTitle>Add a new task</DialogTitle>
            <DialogDescription>
              Fill in the details for the new task in this silo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                placeholder="e.g. Design the landing page"
                {...register('title')}
              />
              {errors.title && (
                <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
              )}
            </div>

            <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                    <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.priority && (
                            <p className="text-sm text-destructive mt-1">{errors.priority.message}</p>
                        )}
                    </div>
                )}
            />

            <Controller
                name="assigneeId"
                control={control}
                render={({ field }) => (
                    <div className="space-y-2">
                        <Label htmlFor="assigneeId">Assign To</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a team member" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {workspaceUsers.map(user => (
                                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         {errors.assigneeId && (
                            <p className="text-sm text-destructive mt-1">{errors.assigneeId.message}</p>
                        )}
                    </div>
                )}
            />

            <Controller
              name="dueDate"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
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
                    {errors.dueDate && (
                        <p className="text-sm text-destructive mt-1">{errors.dueDate.message}</p>
                    )}
                </div>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
