
'use client';

import React from 'react';
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Folder, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { bytesToSize } from '@/lib/files';
import { DeleteDialog } from '../common/delete-dialog';
import type { WorkspaceFile } from '@/lib/types';
import { FilePreview } from './file-preview';

interface FileListItemProps {
    item: WorkspaceFile;
    ownerName?: string;
    onItemClick: (item: WorkspaceFile) => void;
    onDeleteItem: (item: WorkspaceFile) => void;
    isDeleting: boolean;
}

export function FileListItem({ item, ownerName, onItemClick, onDeleteItem, isDeleting }: FileListItemProps) {
    return (
        <TableRow key={item.id} className="cursor-pointer" onDoubleClick={() => onItemClick(item)}>
            <TableCell className="font-medium">
                <button className="flex items-center gap-4 text-left" onClick={() => onItemClick(item)}>
                {item.type === 'folder' ? <Folder className="h-6 w-6 text-amber-500" /> : <FilePreview file={item} />}
                <span>{item.name}</span>
                </button>
            </TableCell>
            <TableCell className="hidden sm:table-cell text-muted-foreground">{ownerName || '...'}</TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">{item.createdAt ? format(item.createdAt.toDate(), 'PP') : '-'}</TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">{item.size ? bytesToSize(item.size) : '--'}</TableCell>
            <TableCell>
                <DeleteDialog onConfirm={() => onDeleteItem(item)} itemName={item.name}>
                    <Button variant="ghost" size="icon" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </DeleteDialog>
            </TableCell>
        </TableRow>
    );
}

