import { PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import { AddCompanyDialog } from "./add-company-dialog";

export function AddCompanyButton({ workspaceId }: { workspaceId?: string }) {
  return (
    <AddCompanyDialog workspaceId={workspaceId}>
        <Button size="sm" className="w-full justify-start">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Company
        </Button>
    </AddCompanyDialog>
  );
}
