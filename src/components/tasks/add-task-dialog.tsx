"use client";

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
import { getWorkspaces, addTask } from "@/lib/data";
import React, { useState } from "react";
import type { Company, Project, Silo, Workspace } from "@/lib/types";
import { AiTaskSuggester } from "./ai-task-suggester";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function AddTaskDialog({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  
  const workspaces = getWorkspaces();
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSilo, setSelectedSilo] = useState<Silo | null>(null);

  const handleWorkspaceChange = (workspaceId: string) => {
    const workspace = workspaces.find(ws => ws.id === workspaceId) || null;
    setSelectedWorkspace(workspace);
    setSelectedCompany(null);
    setSelectedProject(null);
    setSelectedSilo(null);
  };

  const handleCompanyChange = (companyId: string) => {
    const company = selectedWorkspace?.companies.find((c) => c.id === companyId) || null;
    setSelectedCompany(company);
    setSelectedProject(null);
    setSelectedSilo(null);
  };

  const handleProjectChange = (projectId: string) => {
    const project = selectedCompany?.projects.find((p) => p.id === projectId) || null;
    setSelectedProject(project);
    setSelectedSilo(null);
  };

  const handleSiloChange = (siloId: string) => {
    const silo = selectedProject?.silos.find((s) => s.id === siloId) || null;
    setSelectedSilo(silo);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedWorkspace || !selectedCompany || !selectedProject || !selectedSilo || !taskName) return;

    addTask(selectedWorkspace.id, selectedCompany.id, selectedProject.id, selectedSilo.id, {
        name: taskName,
        description: taskDescription,
        completed: false,
        priority: 'medium' // default priority
    });

    toast({
        title: "Task Created",
        description: "The new task has been successfully added.",
    });
    
    setOpen(false);
    // Reset form state
    setTaskName("");
    setTaskDescription("");
    setSelectedWorkspace(null);
    setSelectedCompany(null);
    setSelectedProject(null);
    setSelectedSilo(null);
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
                {workspaces.map((ws) => (
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
            <Select onValueChange={handleCompanyChange} disabled={!selectedWorkspace} required>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {selectedWorkspace?.companies.map((company) => (
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
              disabled={!selectedCompany}
              required
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {selectedCompany?.projects.map((project) => (
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
              disabled={!selectedProject}
              required
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a silo" />
              </SelectTrigger>
              <SelectContent>
                {selectedProject?.silos.map((silo) => (
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
