
'use client';

import React from 'react';
import Image from 'next/image';
import { FileText, FileQuestion } from 'lucide-react';
import type { WorkspaceFile } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FilePreviewProps {
    file: WorkspaceFile;
    small?: boolean;
}

export function FilePreview({ file, small = false }: FilePreviewProps) {
    const renderPreview = () => {
        if (file.mimeType?.startsWith('image/')) {
            return (
                <Image
                    src={file.downloadURL!}
                    alt={`Preview of ${file.name}`}
                    width={small ? 16 : 96}
                    height={small ? 16 : 96}
                    className="w-full h-full object-cover"
                />
            );
        }
        if (file.mimeType === 'application/pdf') {
            return <FileText className={cn("text-red-500", small ? "h-4 w-4" : "h-12 w-12")} />;
        }
        return <FileQuestion className={cn("text-muted-foreground", small ? "h-4 w-4" : "h-12 w-12")} />;
    };
    
    const containerClasses = small 
        ? "w-4 h-4 flex items-center justify-center flex-shrink-0"
        : "w-full h-full rounded overflow-hidden bg-muted flex items-center justify-center flex-shrink-0";


    return (
        <div className={containerClasses}>
            {file.downloadURL ? (
                renderPreview()
            ) : (
                <FileQuestion className={cn("text-muted-foreground", small ? "h-4 w-4" : "h-12 w-12")} />
            )}
        </div>
    );
}
