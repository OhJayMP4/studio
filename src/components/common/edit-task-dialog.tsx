'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
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
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon } from 'lucide-react';
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
import type { Workspace, Task } from '@/lib/types';
import { FormControl, FormField, FormItem, FormMessage } from '../ui/form';
import { Textarea } from '../ui/textarea';
import { updateTask } from '@/lib/tasks';

const formSchema = z.object({
  title: z.string().min(1, 'Task title is required.'),
  description: z.string().optional(),
  dueDate: z.date({ required_error: 'A due date is required.' }),
  priority: z.enum(['low', 'medium', 'high'], {
    required_error: 'Priority is required.',
  }),
  assigneeId: z.string({ required_error: 'An assignee is required.' }),
});

type FormValues = z.infer<typeof formSchema>;

interface EditTaskDialogProps {
  task: Task;
  path: string;
  children: React.ReactNode;
}

const getWorkspaceUsers = (workspace: Workspace | null) => {
    if (!workspace || !workspace.users) return [];
    return Object.entries(workspace.users).map(([uid, userData]) => ({
        id: uid,
        name: userData.name || 'Unnamed User',
    }));
}

export function EditTaskDialog({ task, path, children }: EditTaskDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });
  
  const workspaceUsers = getWorkspaceUsers(selectedWorkspace);

  useEffect(() => {
    if (isOpen) {
        form.reset({
            title: task.title,
            description: task.description,
            dueDate: new Date(task.dueDate),
            priority: task.priority,
            assigneeId: task.assigneeId,
        });
    }
  }, [isOpen, task, form]);

  const handleUpdateTask = async (data: FormValues) => {
    if (!selectedWorkspace || !user) return;

    try {
      await updateTask(
        firestore,
        path,
        task.id,
        {
            title: data.title,
            description: data.description || '',
            dueDate: data.dueDate.toISOString(),
            priority: data.priority,
            assigneeId: data.assigneeId,
            updatedBy: user.uid,
        },
        task.assigneeId // Passing old assignee to handle synchronization
      );
      
      toast({
        title: 'Task Updated',
        description: `The "${data.title}" task has been successfully updated.`,
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update the task.',
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleUpdateTask)}>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                Update the details for "{task.title}".
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <Label>Task Title</Label>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <Label>Description</Label>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                      <FormItem>
                          <Label>Priority</Label>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                          <FormMessage />
                      </FormItem>
                  )}
              />

              <FormField
                  control={form.control}
                  name="assigneeId"
                  render={({ field }) => (
                      <FormItem>
                          <Label>Assign To</Label>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                          <FormMessage />
                      </FormItem>
                  )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className='flex flex-col'>
                      <Label>Due Date</Label>
                      <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                  variant={"outline"}
                                  className={cn("w-full justify-start text-left font-normal",!field.value && "text-muted-foreground")}
                              >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </FormControl>
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
                      <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
