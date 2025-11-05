'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { FileBrowser } from "@/components/files/file-browser";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

function FilesBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">Files</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}


function WorkspaceFilesView() {
    const { selectedWorkspace } = useSelectedWorkspace();
    
    if (!selectedWorkspace) return null;

    return (
        <div className="space-y-6">
            <FilesBreadcrumb />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-headline">Workspace Files</h1>
            </div>
            <FileBrowser />
        </div>
    )
}


export default function FilesPage() {
  const { selectedWorkspace } = useSelectedWorkspace();

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Welcome to SaturnSync</CardTitle>
            <CardDescription>Select a workspace from the sidebar to get started, or create a new one.</CardDescription>
          </CardHeader>
          <CardContent>
             <AddWorkspaceDialog open={false} onOpenChange={() => {}} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <WorkspaceFilesView />;
}
