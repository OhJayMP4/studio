import { PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import { AddWorkspaceDialog } from "./add-workspace-dialog";

export function AddWorkspaceButton() {
  return (
    <AddWorkspaceDialog>
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Workspace
        </Button>
    </AddWorkspaceDialog>
  );
}
