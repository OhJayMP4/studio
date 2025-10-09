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
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { addDocumentNonBlocking } from "@/firebase";
import { collection } from "firebase/firestore";


interface AddSiloDialogProps {
  children: React.ReactNode;
  workspaceId: string;
  companyId: string;
  projectId?: string;
}

export function AddSiloDialog({ children, workspaceId, companyId, projectId }: AddSiloDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const [open, setOpen] = useState(false);
  const [siloName, setSiloName] = useState("");

  const projectsRef = useMemoFirebase(() => collection(firestore, "companies", companyId, "projects"), [firestore, companyId]);
  const { data: projects } = useCollection<Project>(projectsRef);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);


  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId]);

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!siloName || !selectedProjectId) return;

    const silosCol = collection(firestore, `projects/${selectedProjectId}/silos`);
    addDocumentNonBlocking(silosCol, {
      name: siloName,
      projectId: selectedProjectId
    });

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
              <Select onValueChange={handleProjectChange} defaultValue={selectedProjectId} required>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((p) => (
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
