
'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChatRoom } from "@/components/chat/chat-room";

export default function ChatPage() {
  const { selectedWorkspace } = useSelectedWorkspace();

  if (!selectedWorkspace) return null;

  return (
    <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-headline">Chat</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col flex-1 min-h-0">
        <h1 className="text-3xl font-headline font-bold mb-4 shrink-0">Workspace Chat</h1>
        <Card className="flex-1 flex flex-col min-h-0 shadow-sm border-none bg-card/50 overflow-hidden">
          <CardHeader className="shrink-0 pb-4 border-b bg-muted/5">
            <CardTitle className="text-lg">Main Chat Room</CardTitle>
            <CardDescription>A shared space for everyone in {selectedWorkspace.name}.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ChatRoom />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
