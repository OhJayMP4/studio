'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirebase, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Task, Company, Project } from '@/lib/types';
import { TeamOverview } from './team-overview';
import { TeamBreakdownFilters } from './team-breakdown-filters';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';

export function TeamBreakdownView() {
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const { firebaseApp } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Filters state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  
  // Data state
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // 3. Fetch Team Data via Cloud Function (Backend Powered)
  useEffect(() => {
    if (!selectedWorkspace || !firebaseApp || !isUserAdmin) {
        setIsLoading(false);
        return;
    }

    const fetchTeamData = async () => {
        setIsLoading(true);
        try {
            const functions = getFunctions(firebaseApp);
            const generateTeamReport = httpsCallable(functions, 'generateTeamReport');
            
            // Get all workspace users
            const userIds = Object.keys(selectedWorkspace.users);
            
            const result = await generateTeamReport({
                workspaceId: selectedWorkspace.id,
                userIds: userIds,
            });

            // result.data is an array of { user: Profile, tasks: Task[] }
            const reportData = result.data as any[];
            const aggregatedTasks = reportData.flatMap(u => u.tasks);
            
            setAllTasks(aggregatedTasks);
        } catch (error: any) {
            console.error("Failed to fetch team breakdown:", error);
            toast({
                variant: 'destructive',
                title: 'Data Load Failed',
                description: error.message || 'Could not load team workload data.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    fetchTeamData();
  }, [selectedWorkspace, firebaseApp, isUserAdmin, toast]);

  // Filter tasks based on selections
  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter(task => {
      const companyMatch = selectedCompanyId === 'all' || task.companyId === selectedCompanyId;
      const projectMatch = selectedProjectId === 'all' || task.projectId === selectedProjectId;
      return companyMatch && projectMatch;
    });
  }, [allTasks, selectedCompanyId, selectedProjectId]);

  if (!isUserAdmin) {
      return (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Admin Access Required</AlertTitle>
          <AlertDescription>
            You must be a workspace admin to view the team breakdown report.
          </AlertDescription>
        </Alert>
      );
  }

  if (isLoading) {
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
          <AlertTitle>No Active Workload</AlertTitle>
          <AlertDescription>
            There are no active tasks matching your current filters.
          </AlertDescription>
        </Alert>
      ) : (
        <TeamOverview tasks={filteredTasks} />
      )}
    </div>
  );
}