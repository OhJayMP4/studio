'use client';

import { useState, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Company, Project, Silo } from '@/lib/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { FormControl, FormField, FormItem, FormMessage } from '../ui/form';
import { AddCompanyDialog } from './add-company-dialog';
import { AddProjectDialog } from './add-project-dialog';
import { AddSiloDialog } from './add-silo-dialog';
import { AddTaskDialog } from './add-task-dialog';


type AddEntityType = 'company' | 'project' | 'silo' | 'task';

export function GlobalQuickAdd() {
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const firestore = useFirestore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<AddEntityType | null>(null);
  
  // State for chained selections
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSiloId, setSelectedSiloId] = useState<string | null>(null);

  // --- Data Fetching ---
  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
  }, [firestore, selectedWorkspace]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const projectsQuery = useMemoFirebase(() => {
    if (!selectedWorkspace || !selectedCompanyId) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', selectedCompanyId, 'projects');
  }, [firestore, selectedWorkspace, selectedCompanyId]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const silosQuery = useMemoFirebase(() => {
    if (!selectedWorkspace || !selectedCompanyId || !selectedProjectId) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', selectedCompanyId, 'projects', selectedProjectId, 'silos');
  }, [firestore, selectedWorkspace, selectedCompanyId, selectedProjectId]);
  const { data: silos } = useCollection<Silo>(silosQuery);

  const openDialog = (type: AddEntityType) => {
    setSelectedEntityType(type);
    setDialogOpen(true);
  };
  
  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedEntityType(null);
    setSelectedCompanyId(null);
    setSelectedProjectId(null);
    setSelectedSiloId(null);
  }
  
  if (!selectedWorkspace) {
    return null;
  }
  
  const renderDialogContent = () => {
    switch (selectedEntityType) {
        case 'project':
            return (
                <div>
                    <Label>Select Company</Label>
                    <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId || undefined}>
                        <SelectTrigger><SelectValue placeholder="Choose a company..." /></SelectTrigger>
                        <SelectContent>
                            {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {selectedCompanyId && <div className="mt-4"><AddProjectDialog companyId={selectedCompanyId} /></div>}
                </div>
            );
        case 'silo':
            return (
                 <div>
                    <Label>Select Company</Label>
                    <Select onValueChange={(val) => { setSelectedCompanyId(val); setSelectedProjectId(null); }} value={selectedCompanyId || undefined}>
                        <SelectTrigger><SelectValue placeholder="Choose a company..." /></SelectTrigger>
                        <SelectContent>
                            {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    
                    {selectedCompanyId && projects && (
                        <div className="mt-4">
                            <Label>Select Project</Label>
                            <Select onValueChange={setSelectedProjectId} value={selectedProjectId || undefined}>
                                <SelectTrigger><SelectValue placeholder="Choose a project..." /></SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {selectedCompanyId && selectedProjectId && <div className="mt-4"><AddSiloDialog companyId={selectedCompanyId} projectId={selectedProjectId} /></div>}
                </div>
            )
        case 'task':
             return (
                 <div>
                    <Label>Select Company</Label>
                    <Select onValueChange={(val) => { setSelectedCompanyId(val); setSelectedProjectId(null); setSelectedSiloId(null); }} value={selectedCompanyId || undefined}>
                        <SelectTrigger><SelectValue placeholder="Choose a company..." /></SelectTrigger>
                        <SelectContent>
                            {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    
                    {selectedCompanyId && projects && (
                        <div className="mt-4">
                            <Label>Select Project</Label>
                            <Select onValueChange={(val) => { setSelectedProjectId(val); setSelectedSiloId(null); }} value={selectedProjectId || undefined}>
                                <SelectTrigger><SelectValue placeholder="Choose a project..." /></SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {selectedCompanyId && selectedProjectId && silos && (
                         <div className="mt-4">
                            <Label>Select Silo</Label>
                            <Select onValueChange={setSelectedSiloId} value={selectedSiloId || undefined}>
                                <SelectTrigger><SelectValue placeholder="Choose a silo..." /></SelectTrigger>
                                <SelectContent>
                                    {silos.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {selectedCompanyId && selectedProjectId && selectedSiloId && (
                        <div className="mt-4">
                            <AddTaskDialog companyId={selectedCompanyId} projectId={selectedProjectId} siloId={selectedSiloId} />
                        </div>
                    )}
                </div>
            )
        default: return null;
    }
  }

  const getDialogTitle = () => {
    switch (selectedEntityType) {
        case 'project': return 'Add New Project';
        case 'silo': return 'Add New Silo';
        case 'task': return 'Add New Task';
        default: return 'Add New Item';
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Plus className="h-4 w-4" />
            <span className="sr-only">Quick Add</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Quick Add</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isUserAdmin && (
             <AddCompanyDialog>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    Company
                </DropdownMenuItem>
            </AddCompanyDialog>
          )}
          {isUserAdmin && <DropdownMenuItem onSelect={() => openDialog('project')}>Project</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => openDialog('silo')}>Silo</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog('task')}>Task</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>{getDialogTitle()}</DialogTitle>
                <DialogDescription>
                    Select the hierarchy to add your new item.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                {renderDialogContent()}
            </div>
          </DialogContent>
      </Dialog>
    </>
  );
}
