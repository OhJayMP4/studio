
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, deleteDoc, doc, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
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
import { Folder, Trash2, Grid, List } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { bytesToSize } from '@/lib/files';
import { UploadFileDialog } from './upload-file-dialog';
import { DeleteDialog } from '../common/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import type { WorkspaceFile, UserProfile } from '@/lib/types';
import { CreateFolderDialog } from './create-folder-dialog';
import { useDocs } from '@/firebase/firestore/use-docs';
import { FileGridItem } from './file-grid-item';
import { FileListItem } from './file-list-item';
import { cn } from '@/lib/utils';

export function FileBrowser() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<(WorkspaceFile & {id: string})[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!selectedWorkspace?.id || !firestore) {
      setFiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const filesQuery = query(
      collection(firestore, 'workspace-files'),
      where('workspaceId', '==', selectedWorkspace.id),
      where('parentPath', '==', currentPath),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(filesQuery,
      (snapshot) => {
        const fileList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as WorkspaceFile & {id: string}));
        
        const sortedFileList = fileList.sort((a, b) => {
          if (a.type === 'folder' && b.type === 'file') return -1;
          if (a.type === 'file' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });

        setFiles(sortedFileList);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading files:", error);
        toast({
          variant: 'destructive',
          title: 'Error Loading Files',
          description: error.message
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedWorkspace?.id, firestore, currentPath, toast]);

  const userIds = useMemo(() => {
    return [...new Set(files.map(f => f.uploadedBy).filter(Boolean))];
  }, [files]);
  
  const { data: users, isLoading: usersLoading } = useDocs<UserProfile>(userIds.map(uid => `users/${uid}`));
  const usersMap = useMemo(() => {
    if (!users) return new Map<string, string>();
    return new Map(users.map(u => [u.id, u.name || 'Unknown User']));
  }, [users]);


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
        window.open(item.downloadURL, '_blank', 'noopener,noreferrer');
    }
  }

  const handleDeleteItem = async (item: WorkspaceFile) => {
    if (!selectedWorkspace) return;
    setIsDeleting(true);
    const storage = getStorage();
    const batch = writeBatch(firestore);

    try {
        if (item.type === 'file') {
            const fileRef = ref(storage, item.fullPath);
            await deleteObject(fileRef).catch(e => console.warn(`Could not delete storage object ${item.fullPath}: ${e.message}`));
            const metaRef = doc(firestore, 'workspace-files', item.id);
            batch.delete(metaRef);
        } else {
            const allFilesCollection = collection(firestore, 'workspace-files');
            
            // Note: This complex query now relies on the composite index
            const itemsToDeleteQuery = query(allFilesCollection, where('workspaceId', '==', selectedWorkspace.id), where('fullPath', '>=', item.fullPath));
            const itemsToDeleteSnap = await getDocs(itemsToDeleteQuery);
            
            for (const docSnap of itemsToDeleteSnap.docs) {
                const docData = docSnap.data() as WorkspaceFile;
                if (docData.fullPath.startsWith(item.fullPath)) {
                    batch.delete(docSnap.ref);
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
        setIsDeleting(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
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
        <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-muted p-1 rounded-md">
              <Button size="sm" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} onClick={() => setViewMode('grid')} className="h-8 w-8 p-0">
                  <Grid className="h-4 w-4" />
              </Button>
               <Button size="sm" variant={viewMode === 'list' ? 'secondary' : 'ghost'} onClick={() => setViewMode('list')} className="h-8 w-8 p-0">
                  <List className="h-4 w-4" />
              </Button>
            </div>
            <CreateFolderDialog currentPath={currentPath} />
            <UploadFileDialog currentPath={currentPath} />
        </div>
      </div>

       {loading && (
          <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
          </div>
        )}
        
        {!loading && files.length === 0 && (
             <div className="h-48 flex items-center justify-center border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No files or folders here.</p>
             </div>
        )}
        
        {!loading && files.length > 0 && viewMode === 'grid' && (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {files.map(item => (
                    <FileGridItem 
                        key={item.id} 
                        item={item} 
                        onItemClick={handleItemClick}
                        onDeleteItem={handleDeleteItem}
                        isDeleting={isDeleting}
                    />
                ))}
             </div>
        )}

        {!loading && files.length > 0 && viewMode === 'list' && (
            <div className="border rounded-md">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Owner</TableHead>
                    <TableHead className="hidden md:table-cell">Last Modified</TableHead>
                    <TableHead className="hidden md:table-cell">Size</TableHead>
                    <TableHead className="w-10"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {files.map((item) => (
                        <FileListItem
                            key={item.id}
                            item={item}
                            ownerName={usersMap.get(item.uploadedBy)}
                            onItemClick={handleItemClick}
                            onDeleteItem={handleDeleteItem}
                            isDeleting={isDeleting}
                         />
                    ))}
                </TableBody>
                </Table>
            </div>
        )}

    </div>
  );
}

