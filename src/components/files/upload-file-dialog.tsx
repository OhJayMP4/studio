
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/auth/use-user';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { bytesToSize } from '@/lib/files';

interface UploadFileDialogProps {
  currentPath: string;
}

export function UploadFileDialog({ currentPath }: UploadFileDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);

  const { toast } = useToast();
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });
  
  const removeFile = (fileName: string) => {
      setFiles(files.filter(f => f.name !== fileName));
  }

  const handleUpload = async () => {
    if (!user || !selectedWorkspace || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress({});

    const storage = getStorage();
    const batch = writeBatch(firestore);

    const uploadPromises = files.map(file => {
      return new Promise<void>((resolve, reject) => {
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
        const storageRef = ref(storage, `workspaces/${selectedWorkspace.id}/files/${filePath}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
          },
          (error) => {
            console.error(`Upload failed for ${file.name}:`, error);
            toast({ variant: 'destructive', title: `Upload failed for ${file.name}` });
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const fileMetaRef = doc(collection(firestore, 'workspace-files'));
              
              batch.set(fileMetaRef, {
                  type: 'file',
                  name: file.name,
                  fullPath: storageRef.fullPath,
                  parentPath: currentPath,
                  size: file.size,
                  mimeType: file.type,
                  downloadURL,
                  uploadedBy: user.uid,
                  createdAt: serverTimestamp(),
                  workspaceId: selectedWorkspace.id,
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    });

    try {
        await Promise.all(uploadPromises);
        await batch.commit();
        toast({ title: 'Upload successful', description: `${files.length} file(s) have been uploaded.` });
        setFiles([]);
        setIsOpen(false);
    } catch (error) {
        console.error("Error during final upload step:", error);
        toast({ variant: 'destructive', title: 'Upload failed', description: 'An error occurred during the final upload step.' });
    } finally {
        setIsUploading(false);
    }
  };

  const totalProgress = useMemo(() => {
    if (Object.keys(uploadProgress).length === 0) return 0;
    const total = Object.values(uploadProgress).reduce((acc, curr) => acc + curr, 0);
    return total / Object.keys(uploadProgress).length;
  }, [uploadProgress]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!isUploading) {
            setIsOpen(open);
            if (!open) setFiles([]);
        }
    }}>
      <DialogTrigger asChild>
        <Button>Upload File</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Drag and drop files here or click to browse. Files will be uploaded to the current folder.
          </DialogDescription>
        </DialogHeader>
        <div
          {...getRootProps()}
          className={`mt-4 p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-border'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input {...getInputProps()} id="file-input" />
          <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {isDragActive ? 'Drop files here' : 'Drag & drop files or click to browse'}
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            <h4 className="font-semibold">Files to upload:</h4>
            {files.map(file => (
              <div key={file.name} className="flex items-center justify-between p-2 bg-muted rounded-md">
                <div className="flex items-center gap-2 overflow-hidden">
                   <FileIcon className="h-4 w-4 flex-shrink-0" />
                   <span className="truncate text-sm">{file.name}</span>
                   <span className="text-xs text-muted-foreground flex-shrink-0">{bytesToSize(file.size)}</span>
                </div>
                {!isUploading && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(file.name)}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
                {isUploading && uploadProgress[file.name] !== undefined && (
                   <Progress value={uploadProgress[file.name]} className="w-1/4 h-2" />
                )}
              </div>
            ))}
          </div>
        )}
        
        {isUploading && <Progress value={totalProgress} className="w-full mt-4 h-2" />}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || isUploading}>
            {isUploading ? `Uploading...` : `Upload ${files.length} file(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    