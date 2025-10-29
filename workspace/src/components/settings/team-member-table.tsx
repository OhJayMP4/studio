'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { useUser, useFirestore } from "@/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import { doc, updateDoc, arrayRemove } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { DeleteDialog } from "../common/delete-dialog";


export function TeamMemberTable() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    if (!selectedWorkspace || !currentUser) return null;

    const members = Object.entries(selectedWorkspace.users).map(([uid, userData]) => ({
        uid,
        ...userData,
    }));

    const handleRoleChange = async (targetUid: string, newRole: 'admin' | 'contributor' | 'viewer') => {
        if (!selectedWorkspace) return;

        // Prevent admin from accidentally demoting themselves if they are the only admin
        const adminCount = members.filter(m => m.role === 'admin').length;
        if (targetUid === currentUser.uid && members.find(m => m.uid === targetUid)?.role === 'admin' && adminCount <= 1) {
            toast({ variant: 'destructive', title: "Action Not Allowed", description: "You cannot demote the only admin in the workspace." });
            return;
        }

        try {
            const workspaceRef = doc(firestore, 'workspaces', selectedWorkspace.id);
            await updateDoc(workspaceRef, {
                [`users.${targetUid}.role`]: newRole,
            });
            toast({ title: "Role Updated", description: `Role for ${members.find(m => m.uid === targetUid)?.name} has been changed to ${newRole}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        }
    };

    const handleRemoveUser = async (targetUid: string, targetName: string | null) => {
        if (!selectedWorkspace) return;
        
        try {
            const workspaceRef = doc(firestore, 'workspaces', selectedWorkspace.id);
            const userRef = doc(firestore, 'users', targetUid);

            // Firestore does not allow deleting fields from a map in a single command with arrayRemove
            // A more complex transaction or a cloud function would be needed for atomicity.
            // For client-side simplicity, we perform two separate updates.
            
            // 1. Remove from users map (we need to get the current map and remove the key)
            const newUsersMap = { ...selectedWorkspace.users };
            delete newUsersMap[targetUid];
            
            await updateDoc(workspaceRef, {
                users: newUsersMap,
                memberIds: arrayRemove(targetUid),
            });

            // 2. Remove workspaceId from the user's profile
            await updateDoc(userRef, {
                workspaceIds: arrayRemove(selectedWorkspace.id),
            });

            toast({ title: "User Removed", description: `${targetName || 'The user'} has been removed from the workspace.` });

        } catch (error: any) {
             toast({ variant: 'destructive', title: "Removal Failed", description: error.message });
        }
    };

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map(({ uid, name, avatarUrl, role }) => {
                        const fallback = name ? name.charAt(0).toUpperCase() : '?';
                        const isCurrentUser = uid === currentUser.uid;
                        const isLastAdmin = role === 'admin' && members.filter(m => m.role === 'admin').length <= 1;

                        return (
                            <TableRow key={uid}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={avatarUrl ?? undefined} />
                                            <AvatarFallback>{fallback}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{name || 'Unnamed User'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        defaultValue={role}
                                        onValueChange={(value) => handleRoleChange(uid, value as 'admin' | 'contributor' | 'viewer')}
                                        disabled={isCurrentUser && isLastAdmin}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="contributor">Contributor</SelectItem>
                                            <SelectItem value="viewer">Viewer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DeleteDialog
                                        onConfirm={() => handleRemoveUser(uid, name)}
                                        itemName={name || 'this user'}
                                    >
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={isCurrentUser}
                                            aria-label={`Remove ${name}`}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </DeleteDialog>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}