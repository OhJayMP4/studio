'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { doc, onSnapshot, setDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import type { Workspace, UserProfile } from '@/lib/types';
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

function useUserWorkspaces() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    const userRef = doc(firestore, 'users', user.uid);
    
    const unsubUser = onSnapshot(userRef, (userSnap) => {
      if (!userSnap.exists()) {
        setError('User document not found—creating...');
        setDoc(userRef, { email: user.email, name: user.displayName || '', workspaceIds: [] }, { merge: true })
          .then(() => setError(null))
          .catch(err => {
            console.error("Error creating user doc:", err);
            setError("Failed to create user profile.");
          })
          .finally(() => setIsLoading(false));
        return;
      }
      
      const { workspaceIds = [] } = userSnap.data() as UserProfile;
      setError(null);
      
      if (workspaceIds.length === 0) {
          setWorkspaces([]);
          setIsLoading(false);
          return;
      }

      const unsubs: (() => void)[] = [];
      workspaceIds.forEach((wsId: string) => {
        const workspaceRef = doc(firestore, 'workspaces', wsId);
        const unsubWorkspace = onSnapshot(workspaceRef, (wsSnap) => {
            setWorkspaces(prev => {
              const wsMap = new Map(prev.map(w => [w.id, w]));
              if (wsSnap.exists()) {
                const wsData = wsSnap.data() as Omit<Workspace, 'id'>;
                 if(wsData.memberIds?.includes(user.uid)) {
                   wsMap.set(wsId, { id: wsId, ...wsData });
                 } else {
                   wsMap.delete(wsId);
                 }
              } else {
                 wsMap.delete(wsId);
              }
              return Array.from(wsMap.values());
            });
        }, (wsErr: any) => {
            if (wsErr.code === 'permission-denied') {
                console.warn(`Permission denied for workspace ${wsId}. Removing from user's list.`);
                updateDoc(userRef, {
                    workspaceIds: arrayRemove(wsId)
                });
            } else {
                console.error('Ws snapshot error:', wsErr);
                setError(`Workspace ${wsId} error: ${wsErr.message}`);
            }
        });
        unsubs.push(unsubWorkspace);
      });

      setIsLoading(false);

      return () => {
        unsubs.forEach(u => u());
      }

    }, (userErr) => {
      console.error('User snapshot error:', userErr);
      setError(`User doc error: ${userErr.message}`);
      setIsLoading(false);
    });

    return () => unsubUser();
  }, [user, firestore]);
  
  return { workspaces, isLoading, error };
}


export function WorkspaceSwitcher() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { selectedWorkspace, setSelectedWorkspace } = useSelectedWorkspace();
  const { workspaces, isLoading, error } = useUserWorkspaces();

  useEffect(() => {
    if (!isLoading && workspaces) {
      if (!selectedWorkspace || !workspaces.find(w => w.id === selectedWorkspace.id)) {
        setSelectedWorkspace(workspaces[0] || null);
      }
    }
  }, [workspaces, isLoading, selectedWorkspace, setSelectedWorkspace]);


  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2">
         <Skeleton className="h-6 w-6 rounded-md" />
         <Skeleton className="h-5 w-32" />
         <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
      </div>
    )
  }

  if (error) {
     return (
        <div className="p-2 text-xs text-destructive-foreground bg-destructive rounded-md">
            <p>Error: {error}</p>
            <Button variant="link" size="sm" className="p-0 h-auto text-destructive-foreground" onClick={() => window.location.reload()}>Retry</Button>
        </div>
     );
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
             {selectedWorkspace ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
                    {selectedWorkspace.name.charAt(0).toUpperCase()}
                </div>
            ) : (
                 <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
                    -
                 </div>
            )}
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
            <CommandEmpty>
                <div className='p-4 text-sm text-center'>
                    <p>No workspace found.</p>
                     <AddWorkspaceDialog>
                        <Button variant="link" className='mt-2'>Create your first workspace</Button>
                    </AddWorkspaceDialog>
                </div>
            </CommandEmpty>
            <CommandGroup heading="Workspaces">
              {workspaces?.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  onSelect={(currentValue) => {
                    const selected = workspaces.find(ws => ws.name.toLowerCase() === currentValue);
                    if (selected) {
                      setSelectedWorkspace(selected);
                    }
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
