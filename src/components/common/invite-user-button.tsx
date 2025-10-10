import { UserPlus } from "lucide-react";
import { Button } from "../ui/button";
import { InviteUserDialog } from "./invite-user-dialog";

export function InviteUserButton({ workspaceId }: { workspaceId: string }) {
  return (
    <InviteUserDialog workspaceId={workspaceId}>
        <Button size="sm" variant="outline">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
        </Button>
    </InviteUserDialog>
  );
}
