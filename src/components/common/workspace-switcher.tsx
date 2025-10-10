'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { collection, query, where } from 'firebase/firestore';
import type { Workspace } from '@/lib/types';
import {
  ChevronsUpDown,
  PlusCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AddWorkspaceDialog } from './add-workspace-dialog';
import { Skeleton } from '../ui/skeleton';

export function WorkspaceSwitcher() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { selectedWorkspace, setSelectedWorkspace } = useSelectedWorkspace();

  const workspacesQuery = useMemoFirebase(() => {
    if (!user) return null;
    // FIXED: Scoped to user
    // This query now correctly fetches only the workspaces where the user is a member.
    return query(
      collection(firestore, 'workspaces'),
      where('memberIds', 'array-contains', user.uid)
    );
  }, [firestore, user]);

  const { data: workspaces, isLoading } = useCollection<Workspace>(workspacesQuery);

  if (isLoading || !user) {
    return (
      <div className="flex items-center gap-2">
         <Skeleton className="h-10 w-10 rounded-lg" />
         <Skeleton className="h-6 w-32" />
      </div>
    )
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
               {selectedWorkspace ? selectedWorkspace.name.charAt(0).toUpperCase() : '-'}
            </div>
            <span className="truncate">
              {selectedWorkspace
                ? selectedWorkspace.name
                : 'Select a workspace'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--sidebar-width] p-0">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search workspace..." />
            <CommandEmpty>No workspace found.</CommandEmpty>
            <CommandGroup heading="Workspaces">
              {workspaces?.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  onSelect={() => {
                    setSelectedWorkspace(workspace);
                    setPopoverOpen(false);
                  }}
                  className="text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{workspace.name}</span>
                  </div>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      selectedWorkspace?.id === workspace.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
                <AddWorkspaceDialog>
                    <CommandItem
                        onSelect={() => {
                            setPopoverOpen(false);
                        }}
                    >
                        <PlusCircle className="mr-2 h-5 w-5" />
                        Create Workspace
                    </CommandItem>
                </AddWorkspaceDialog>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
