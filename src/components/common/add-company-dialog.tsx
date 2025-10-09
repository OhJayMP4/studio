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
import type { Workspace } from "@/lib/types";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { addDocumentNonBlocking } from "@/firebase";
import { collection, query, where } from "firebase/firestore";

export function AddCompanyDialog({ children, workspaceId }: { children: React.ReactNode, workspaceId?: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  
  const workspacesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, "workspaces"), where("ownerId", "==", user.uid));
  }, [firestore, user]);

  const { data: workspaces } = useCollection<Workspace>(workspacesQuery);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId);


  const handleWorkspaceChange = (id: string) => {
    setSelectedWorkspaceId(id);
  };
  
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName || !selectedWorkspaceId) return;

    const companiesCol = collection(firestore, `workspaces/${selectedWorkspaceId}/companies`);
    addDocumentNonBlocking(companiesCol, {
      name: companyName,
      workspaceId: selectedWorkspaceId,
    });

    toast({
        title: "Company Created",
        description: "The new company has been successfully added.",
    });
    
    setOpen(false);
    setCompanyName("");
    router.refresh();
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
              <Select onValueChange={handleWorkspaceChange} defaultValue={selectedWorkspaceId} required>
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
