'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { useUser, useFirestore, useFirebase } from "@/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { DeleteDialog } from "../common/delete-dialog";
import { getFunctions, httpsCallable } from "firebase/functions";


export function TeamMemberTable() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { firebaseApp } = useFirebase();
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

    const handleRemoveUser = async (userIdToRemove: string, targetName: string | null) => {
        if (!selectedWorkspace) return;

        const workspaceRef = doc(firestore, 'workspaces', selectedWorkspace.id);
        const userRef = doc(firestore, 'users', userIdToRemove);

        try {
            const batch = writeBatch(firestore);

            // 1. Remove user from the workspace document
            batch.update(workspaceRef, {
                memberIds: selectedWorkspace.memberIds.filter(id => id !== userIdToRemove),
                [`users.${userIdToRemove}`]: undefined, // This requires dot notation for field deletion in update
            });

            // 2. Remove workspace from the user's document
            batch.update(userRef, {
                workspaceIds: selectedWorkspace.users[userIdToRemove] ? 
                    (selectedWorkspace as any).workspaceIds?.filter((id: string) => id !== selectedWorkspace!.id) || [] : 
                    undefined
            });
            
            await batch.commit();

            toast({
              title: "User Removed",
              description: `${targetName || 'The user'} has been removed from the workspace.`
            });
            
          } catch (error: any) {
            console.error('Error removing user:', error);
            toast({
              variant: "destructive",
              title: "Failed to Remove User",
              description: error.message || "An error occurred. Check security rules."
            });
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
                        const isOwner = uid === selectedWorkspace.ownerId;
                        // You can't remove yourself or the owner.
                        const canBeRemoved = !isCurrentUser && !isOwner;

                        return (
                            <TableRow key={uid}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={avatarUrl ?? undefined} />
                                            <AvatarFallback>{fallback}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{name || 'Unnamed User'} {isCurrentUser && '(You)'}</span>
                                            {isOwner && <span className="text-xs text-muted-foreground">Owner</span>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        defaultValue={role}
                                        onValueChange={(value) => handleRoleChange(uid, value as 'admin' | 'contributor' | 'viewer')}
                                        disabled={isOwner} // Only the owner role cannot be changed
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
                                            disabled={!canBeRemoved}
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
