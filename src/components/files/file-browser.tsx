
'use client';

import React, { useState, useMemo } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from "firebase/storage";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from '@/components/ui/button';
import { Folder, File as FileIcon, MoreVertical, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { bytesToSize } from '@/lib/files';
import { UploadFileDialog } from './upload-file-dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { DeleteDialog } from '../common/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import type { WorkspaceFile } from '@/lib/types';


export function FileBrowser() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return query(
      collection(firestore, 'workspace-files'),
      where('workspaceId', '==', selectedWorkspace.id),
      where('parentPath', '==', currentPath),
      orderBy('type', 'desc'), // folders first
      orderBy('name', 'asc')
    );
  }, [firestore, selectedWorkspace, currentPath]);

  const { data: files, isLoading: filesLoading } = useCollection<WorkspaceFile>(filesQuery);

  const breadcrumbParts = useMemo(() => {
    if (currentPath === '') return [];
    return currentPath.split('/');
  }, [currentPath]);

  const handleBreadcrumbClick = (index: number) => {
    const newPath = breadcrumbParts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };
  
  const handleItemClick = (item: WorkspaceFile) => {
      if (item.type === 'folder') {
          setCurrentPath(item.fullPath);
      } else if (item.downloadURL) {
          window.open(item.downloadURL, '_blank');
      }
  }

  const handleDeleteItem = async (item: WorkspaceFile) => {
    if (!selectedWorkspace) return;
    setIsLoading(true);
    const storage = getStorage();
    const batch = writeBatch(firestore);

    try {
        if (item.type === 'file') {
            // Delete file from Storage
            const fileRef = ref(storage, item.fullPath);
            await deleteObject(fileRef);
            // Delete metadata from Firestore
            const metaRef = doc(firestore, 'workspace-files', item.id);
            batch.delete(metaRef);
        } else {
            // It's a folder, so we need to recursively delete
            const folderPrefix = item.fullPath + '/';
            const allFilesCollection = collection(firestore, 'workspace-files');
            
            // Query for all items inside this folder and subfolders
            const itemsToDeleteQuery = query(allFilesCollection, where('workspaceId', '==', selectedWorkspace.id), where('fullPath', '>=', item.fullPath));
            const itemsToDeleteSnap = await getDocs(itemsToDeleteQuery);
            
            for (const docSnap of itemsToDeleteSnap.docs) {
                const docData = docSnap.data() as WorkspaceFile;
                if (docData.fullPath.startsWith(item.fullPath)) {
                    batch.delete(docSnap.ref); // Delete metadata
                    if (docData.type === 'file') {
                        const fileRef = ref(storage, docData.fullPath);
                        await deleteObject(fileRef).catch(e => console.warn(`Could not delete ${docData.fullPath}: ${e.message}`));
                    }
                }
            }
        }
        
        await batch.commit();
        toast({ title: "Item deleted", description: `"${item.name}" has been permanently removed.` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Deletion failed", description: error.message });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button onClick={() => setCurrentPath('')} className="font-bold">
                  All Files
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbParts.map((part, index) => (
              <React.Fragment key={index}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === breadcrumbParts.length - 1 ? (
                    <BreadcrumbPage>{part}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button onClick={() => handleBreadcrumbClick(index)}>
                        {part}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <UploadFileDialog currentPath={currentPath} />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Last Modified</TableHead>
              <TableHead className="hidden md:table-cell">Size</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filesLoading || isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                </TableRow>
              ))
            ) : files && files.length > 0 ? (
              files.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onDoubleClick={() => handleItemClick(item)}>
                  <TableCell className="font-medium">
                    <button className="flex items-center gap-2 text-left" onClick={() => handleItemClick(item)}>
                      {item.type === 'folder' ? <Folder className="h-4 w-4 text-amber-500" /> : <FileIcon className="h-4 w-4" />}
                      <span>{item.name}</span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{item.createdAt ? format(item.createdAt.toDate(), 'PP') : '-'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{item.size ? bytesToSize(item.size) : '--'}</TableCell>
                   <TableCell>
                        <DeleteDialog onConfirm={() => handleDeleteItem(item)} itemName={item.name}>
                            <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </DeleteDialog>
                   </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No files or folders here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

    