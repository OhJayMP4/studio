'use client';

import { useState } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';

export function TeamReportDialog() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const members = selectedWorkspace
    ? Object.entries(selectedWorkspace.users).map(([uid, data]) => ({
        uid,
        name: data.name || 'Unnamed User',
      }))
    : [];

  const handleSelectUser = (uid: string) => {
    setSelectedUsers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleGenerateReport = () => {
    if (selectedUsers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Members Selected',
        description: 'Please select at least one team member to generate a report.',
      });
      return;
    }

    const params = new URLSearchParams();
    selectedUsers.forEach((uid) => params.append('u', uid));

    const reportUrl = `/reporting/team?${params.toString()}`;
    window.open(reportUrl, '_blank');
    setIsOpen(false);
    setSelectedUsers([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Generate Team Report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Team Report</DialogTitle>
          <DialogDescription>
            Select the team members you want to include in the report.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-64 border rounded-md">
            <div className="p-4 space-y-4">
                {members.length > 0 ? (
                    members.map(({ uid, name }) => (
                        <div key={uid} className="flex items-center space-x-2">
                            <Checkbox
                                id={`user-${uid}`}
                                checked={selectedUsers.includes(uid)}
                                onCheckedChange={() => handleSelectUser(uid)}
                            />
                            <Label
                                htmlFor={`user-${uid}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {name}
                            </Label>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center">No members in this workspace.</p>
                )}
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={handleGenerateReport} disabled={selectedUsers.length === 0}>
            Generate Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
