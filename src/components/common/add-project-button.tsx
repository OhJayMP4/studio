import { PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import { AddProjectDialog } from "./add-project-dialog";

interface AddProjectButtonProps {
    workspaceId: string;
    companyId?: string; // Make companyId optional
}

export function AddProjectButton({ workspaceId, companyId }: AddProjectButtonProps) {
  return (
    <AddProjectDialog workspaceId={workspaceId} companyId={companyId}>
        <Button size="sm" className="w-full justify-start">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Project
        </Button>
    </AddProjectDialog>
  );
}
