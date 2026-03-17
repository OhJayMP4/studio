
'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';
import { duplicateProject } from '@/lib/tasks';
import type { Company, Project } from '@/lib/types';

interface DuplicateProjectDialogProps {
  project: Project;
  companyId: string;
  children: React.ReactNode;
}

export function DuplicateProjectDialog({ project, companyId, children }: DuplicateProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetCompanyId, setTargetCompanyId] = useState<string>('');
  const [targetAssigneeId, setTargetAssigneeId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firestore = useFirestore();
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  // Fetch companies for the workspace
  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
  }, [firestore, selectedWorkspace]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const workspaceUsers = useMemo(() => {
    if (!selectedWorkspace?.users) return [];
    return Object.entries(selectedWorkspace.users).map(([uid, data]) => ({
      uid,
      name: data.name || data.email || 'Team Member',
    }));
  }, [selectedWorkspace]);

  const handleDuplicate = async () => {
    if (!selectedWorkspace || !user || !targetCompanyId || !targetAssigneeId) {
      toast({
        variant: 'destructive',
        title: 'Selection Required',
        description: 'Please select a target company and a new assignee.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await duplicateProject(firestore, {
        workspaceId: selectedWorkspace.id,
        sourceCompanyId: companyId,
        sourceProjectId: project.id,
        targetCompanyId,
        targetAssigneeId,
        currentUserId: user.uid,
      });

      toast({
        title: 'Project Duplicated',
        description: `"${project.name}" has been successfully cloned.`,
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Duplication failed:', error);
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: error.message || 'Could not duplicate the project.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicate Project
          </DialogTitle>
          <DialogDescription>
            This will copy all silos and tasks from "{project.name}" to another company.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="target-company">Target Company</Label>
            <Select value={targetCompanyId} onValueChange={setTargetCompanyId}>
              <SelectTrigger id="target-company">
                <SelectValue placeholder="Select target company" />
              </SelectTrigger>
              <SelectContent>
                {companies?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-assignee">Reassign All Tasks To</Label>
            <Select value={targetAssigneeId} onValueChange={setTargetAssigneeId}>
              <SelectTrigger id="target-assignee">
                <SelectValue placeholder="Select new assignee" />
              </SelectTrigger>
              <SelectContent>
                {workspaceUsers.map((u) => (
                  <SelectItem key={u.uid} value={u.uid}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground italic">
              All tasks in the duplicated project will be assigned to this person.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={isSubmitting || !targetCompanyId || !targetAssigneeId}>
            {isSubmitting ? 'Duplicating...' : 'Confirm Duplication'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
