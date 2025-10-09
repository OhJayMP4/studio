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
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { Company } from "@/lib/types";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { addDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";

interface AddProjectDialogProps {
  children: React.ReactNode;
  workspaceId: string;
  companyId?: string;
}

export function AddProjectDialog({ children, workspaceId, companyId }: AddProjectDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  
  const companiesRef = useMemoFirebase(() => collection(firestore, "workspaces", workspaceId, "companies"), [firestore, workspaceId]);
  const { data: companies } = useCollection<Company>(companiesRef);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(companyId);

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectName || !selectedCompanyId) return;

    const projectsCol = collection(firestore, `companies/${selectedCompanyId}/projects`);
    addDocumentNonBlocking(projectsCol, {
      name: projectName,
      companyId: selectedCompanyId
    });

    toast({
        title: "Project Created",
        description: "The new project has been successfully added.",
    });
    
    setOpen(false);
    setProjectName("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-headline">Add New Project</DialogTitle>
            <DialogDescription>
              Create a new project for a company.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="company" className="text-right">
                Company
              </Label>
              <Select onValueChange={handleCompanyChange} defaultValue={selectedCompanyId} required>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
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
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="E.g. Project Phoenix"
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Create Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
