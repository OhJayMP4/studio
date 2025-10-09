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
import { addSilo, getCompanyById } from "@/lib/data";
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";


interface AddSiloDialogProps {
  children: React.ReactNode;
  workspaceId: string;
  companyId: string;
  projectId?: string;
}

export function AddSiloDialog({ children, workspaceId, companyId, projectId }: AddSiloDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [siloName, setSiloName] = useState("");

  const company = getCompanyById(workspaceId, companyId);
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    projectId ? company?.projects.find(p => p.id === projectId) || null : null
  );

  const handleProjectChange = (id: string) => {
    const project = company?.projects.find(p => p.id === id) || null;
    setSelectedProject(project);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!siloName || !selectedProject) return;

    addSilo(workspaceId, companyId, selectedProject.id, siloName);

    toast({
        title: "Silo Created",
        description: "The new silo has been successfully added.",
    });
    
    setOpen(false);
    setSiloName("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-headline">Add New Silo</DialogTitle>
            <DialogDescription>
              Create a new silo for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="project" className="text-right">
                Project
              </Label>
              <Select onValueChange={handleProjectChange} defaultValue={selectedProject?.id} required>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {company?.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={siloName}
                onChange={(e) => setSiloName(e.target.value)}
                placeholder="E.g. Marketing"
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Create Silo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
