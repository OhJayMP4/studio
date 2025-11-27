
'use client';

import React from 'react';
import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Folder, MoreVertical, Trash2 } from 'lucide-react';
import type { WorkspaceFile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DeleteDialog } from '../common/delete-dialog';
import { FilePreview } from './file-preview';

interface FileGridItemProps {
  item: WorkspaceFile;
  onItemClick: (item: WorkspaceFile) => void;
  onDeleteItem: (item: WorkspaceFile) => void;
  isDeleting: boolean;
}

export function FileGridItem({ item, onItemClick, onDeleteItem, isDeleting }: FileGridItemProps) {
  return (
    <Card 
        onDoubleClick={() => onItemClick(item)} 
        className="relative group hover:shadow-md transition-shadow cursor-pointer"
    >
      <CardHeader className="p-4 flex-col items-center justify-center aspect-square">
        {item.type === 'folder' ? (
          <Folder className="h-16 w-16 text-amber-500" strokeWidth={1.5} />
        ) : (
          <div className="w-24 h-24">
             <FilePreview file={item} />
          </div>
        )}
      </CardHeader>
      <CardFooter className="p-2 border-t">
        <div className="flex items-center justify-between w-full">
           <div className="flex items-center gap-2 truncate">
             {item.type === 'folder' ? (
                <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
                <div className="w-4 h-4 flex-shrink-0">
                    <FilePreview file={item} small />
                </div>
            )}
            <span className="text-sm font-medium truncate" title={item.name}>{item.name}</span>
           </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DeleteDialog onConfirm={() => onDeleteItem(item)} itemName={item.name}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Delete
                    </DropdownMenuItem>
                </DeleteDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
