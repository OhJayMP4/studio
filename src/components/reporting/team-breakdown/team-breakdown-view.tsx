
'use client';

import React, { useState, useMemo } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, collection } from 'firebase/firestore';
import type { Task, Company, Project } from '@/lib/types';
import { TeamOverview } from './team-overview';
import { TeamBreakdownFilters } from './team-breakdown-filters';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function TeamBreakdownView() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  // Filters state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // 1. Fetch Companies for filters
  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
  }, [firestore, selectedWorkspace]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  // 2. Fetch Projects for filters (if company selected)
  const projectsQuery = useMemoFirebase(() => {
    if (!selectedWorkspace || selectedCompanyId === 'all') return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', selectedCompanyId, 'projects');
  }, [firestore, selectedWorkspace, selectedCompanyId]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  // 3. Fetch ALL Active Tasks in the Workspace (Collection Group Query)
  // This is efficient and allows us to group by assignee in memory
  const tasksQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return query(
      collectionGroup(firestore, 'tasks'),
      where('workspaceId', '==', selectedWorkspace.id)
    );
  }, [firestore, selectedWorkspace]);

  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  // Filter tasks based on selections
  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter(task => {
      const companyMatch = selectedCompanyId === 'all' || task.path?.split('/')[3] === selectedCompanyId;
      const projectMatch = selectedProjectId === 'all' || task.projectId === selectedProjectId;
      return companyMatch && projectMatch;
    });
  }, [allTasks, selectedCompanyId, selectedProjectId]);

  if (isTasksLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TeamBreakdownFilters 
        companies={companies || []}
        projects={projects || []}
        selectedCompanyId={selectedCompanyId}
        setSelectedCompanyId={(id) => {
          setSelectedCompanyId(id);
          setSelectedProjectId('all');
        }}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
      />

      {filteredTasks.length === 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Tasks Found</AlertTitle>
          <AlertDescription>
            There are no tasks matching your current filters.
          </AlertDescription>
        </Alert>
      ) : (
        <TeamOverview tasks={filteredTasks} />
      )}
    </div>
  );
}
