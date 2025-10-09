import { PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import { AddSiloDialog } from "./add-silo-dialog";

interface AddSiloButtonProps {
    workspaceId: string;
    companyId: string;
    projectId?: string;
}

export function AddSiloButton({ workspaceId, companyId, projectId }: AddSiloButtonProps) {
  return (
    <AddSiloDialog workspaceId={workspaceId} companyId={companyId} projectId={projectId}>
        <Button size="sm" className="w-full justify-start">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Silo
        </Button>
    </AddSiloDialog>
  );
}
