'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { useUser, useFirestore, useFirebase } from "@/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { DeleteDialog } from "../common/delete-dialog";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useDoc, useMemoFirebase } from "@/firebase";
import { UserProfile } from "@/lib/types";

function TeamMemberRow({ uid, role, email, isOwner, canBeRemoved, onRoleChange, onRemove }: { 
    uid: string; 
    role: 'admin' | 'contributor' | 'viewer'; 
    email: string | null;
    isOwner: boolean;
    canBeRemoved: boolean;
    onRoleChange: (uid: string, role: any) => void;
    onRemove: (uid: string, name: string | null) => void;
}) {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    
    const userRef = useMemoFirebase(() => doc(firestore, 'users', uid), [firestore, uid]);
    const { data: profile } = useDoc<UserProfile>(userRef);

    const isCurrentUser = uid === currentUser?.uid;
    const name = profile?.name || 'Unnamed User';
    const avatarUrl = profile?.avatarUrl || null;
    const fallback = name.charAt(0).toUpperCase();

    return (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={avatarUrl ?? undefined} className="object-cover" />
                        <AvatarFallback>{fallback}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium">{name} {isCurrentUser && '(You)'}</span>
                        <span className="text-xs text-muted-foreground">{email}</span>
                        {isOwner && <span className="text-[10px] mt-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider w-fit">Owner</span>}
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <Select
                    defaultValue={role}
                    onValueChange={(value) => onRoleChange(uid, value)}
                    disabled={isOwner}
                >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
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
                    onConfirm={() => onRemove(uid, name)}
                    itemName={name}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canBeRemoved}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </DeleteDialog>
            </TableCell>
        </TableRow>
    );
}

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

        const adminCount = members.filter(m => m.role === 'admin').length;
        if (targetUid === currentUser.uid && members.find(m => m.uid === targetUid)?.role === 'admin' && adminCount <= 1) {
            toast({ variant: 'destructive', title: "Action Not Allowed", description: "You cannot demote the only admin." });
            return;
        }

        try {
            const workspaceRef = doc(firestore, 'workspaces', selectedWorkspace.id);
            await updateDoc(workspaceRef, {
                [`users.${targetUid}.role`]: newRole,
            });
            toast({ title: "Role Updated" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        }
    };

    const handleRemoveUser = async (userIdToRemove: string, targetName: string | null) => {
        if (!selectedWorkspace || !firebaseApp) return;

        toast({ title: "Removing member..." });

        try {
            const functions = getFunctions(firebaseApp);
            const removeUserFromWorkspace = httpsCallable(functions, 'removeUserFromWorkspace');
            
            await removeUserFromWorkspace({
              workspaceId: selectedWorkspace.id,
              userIdToRemove: userIdToRemove
            });

            toast({
              title: "Member Removed",
              description: `${targetName || 'User'} is no longer part of the workspace.`
            });
            
        } catch (error: any) {
            console.error('Error removing user:', error);
            toast({
              variant: "destructive",
              title: "Removal Failed",
              description: error.message || "An error occurred."
            });
        }
    };

    return (
        <div className="border rounded-md bg-card shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="font-bold">Member</TableHead>
                        <TableHead className="font-bold">Role</TableHead>
                        <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map(({ uid, role, email }) => {
                        const isCurrentUser = uid === currentUser.uid;
                        const isOwner = uid === selectedWorkspace.ownerId;
                        const canBeRemoved = !isCurrentUser && !isOwner;

                        return (
                            <TeamMemberRow 
                                key={uid}
                                uid={uid}
                                role={role as any}
                                email={email || null}
                                isOwner={isOwner}
                                canBeRemoved={canBeRemoved}
                                onRoleChange={handleRoleChange}
                                onRemove={handleRemoveUser}
                            />
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
