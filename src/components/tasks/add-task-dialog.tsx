'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "../ui/textarea";
import React, { useState, useEffect } from "react";
import type { Company, Project, Silo, Workspace } from "@/lib/types";
import { AiTaskSuggester } from "./ai-task-suggester";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, query, where } from "firebase/firestore";

export function AddTaskDialog({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();

  const [open, setOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSiloId, setSelectedSiloId] = useState<string | null>(null);

  const workspacesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, "workspaces"), where("ownerId", "==", user.uid));
  }, [firestore, user]);
  const { data: workspaces } = useCollection<Workspace>(workspacesQuery);

  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspaceId) return null;
    return collection(firestore, `workspaces/${selectedWorkspaceId}/companies`);
  }, [firestore, selectedWorkspaceId]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const projectsQuery = useMemoFirebase(() => {
    if (!selectedCompanyId) return null;
    return collection(firestore, `companies/${selectedCompanyId}/projects`);
  }, [firestore, selectedCompanyId]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const silosQuery = useMemoFirebase(() => {
    if (!selectedProjectId) return null;
    return collection(firestore, `projects/${selectedProjectId}/silos`);
  }, [firestore, selectedProjectId]);
  const { data: silos } = useCollection<Silo>(silosQuery);


  const handleWorkspaceChange = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setSelectedCompanyId(null);
    setSelectedProjectId(null);
    setSelectedSiloId(null);
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedProjectId(null);
    setSelectedSiloId(null);
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedSiloId(null);
  };

  const handleSiloChange = (siloId: string) => {
    setSelectedSiloId(siloId);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSiloId || !taskName) return;

    const tasksCol = collection(firestore, `silos/${selectedSiloId}/tasks`);
    addDocumentNonBlocking(tasksCol, {
      name: taskName,
      description: taskDescription,
      completed: false,
      priority: 'medium', // default priority
      siloId: selectedSiloId,
    });

    toast({
        title: "Task Created",
        description: "The new task has been successfully added.",
    });
    
    setOpen(false);
    // Reset form state
    setTaskName("");
    setTaskDescription("");
    setSelectedWorkspaceId(null);
    setSelectedCompanyId(null);
    setSelectedProjectId(null);
    setSelectedSiloId(null);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Task</DialogTitle>
          <DialogDescription>
            Quickly add a task to any project and silo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Task
            </Label>
            <Input id="name" value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="E.g. Finalize Q4 budget" className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="workspace" className="text-right">
              Workspace
            </Label>
            <Select onValueChange={handleWorkspaceChange} required>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces?.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="company" className="text-right">
              Company
            </Label>
            <Select onValueChange={handleCompanyChange} disabled={!selectedWorkspaceId} required>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="project" className="text-right">
              Project
            </Label>
            <Select
              onValueChange={handleProjectChange}
              disabled={!selectedCompanyId}
              required
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="silo" className="text-right">
              Silo
            </Label>
            <Select
              onValueChange={handleSiloChange}
              disabled={!selectedProjectId}
              required
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a silo" />
              </SelectTrigger>
              <SelectContent>
                {silos?.map((silo) => (
                  <SelectItem key={silo.id} value={silo.id}>
                    {silo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="pt-2 text-right">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Add more details about the task..."
              className="col-span-3"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
          </div>
          <div className="col-span-4 pl-[calc(25%+1rem)]">
             <AiTaskSuggester taskDescription={taskDescription} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Create Task</Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
