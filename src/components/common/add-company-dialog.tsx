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
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { Workspace } from "@/lib/types";

export function AddCompanyDialog({ children, workspaceId }: { children: React.ReactNode, workspaceId?: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    if (open) {
      import('@/lib/data').then(dataLib => {
        const fetchedWorkspaces = dataLib.getWorkspaces();
        setWorkspaces(fetchedWorkspaces);
        if (workspaceId) {
          setSelectedWorkspace(fetchedWorkspaces.find(ws => ws.id === workspaceId) || null);
        }
      });
    }
  }, [open, workspaceId]);


  const handleWorkspaceChange = (id: string) => {
    const workspace = workspaces.find(ws => ws.id === id) || null;
    setSelectedWorkspace(workspace);
  };
  
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName || !selectedWorkspace) return;

    import('@/lib/data').then(dataLib => {
        dataLib.addCompany(selectedWorkspace.id, companyName);

        toast({
            title: "Company Created",
            description: "The new company has been successfully added.",
        });
        
        setOpen(false);
        setCompanyName("");
        router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-headline">Add New Company</DialogTitle>
            <DialogDescription>
              Create a new company within a workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="workspace" className="text-right">
                Workspace
              </Label>
              <Select onValueChange={handleWorkspaceChange} defaultValue={selectedWorkspace?.id} required>
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
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="E.g. Innovate LLC"
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Create Company</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
