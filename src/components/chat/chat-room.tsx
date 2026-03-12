
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import type { ChatMessage, UserProfile } from '@/lib/types';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Send, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';

export function ChatRoom() {
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch current user's profile for the latest name/avatar
  const profileRef = useMemoFirebase(() => {
    return user ? doc(firestore, 'users', user.uid) : null;
  }, [firestore, user]);
  const { data: profile } = useDoc<UserProfile>(profileRef);

  // Fetch messages
  const messagesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return query(
      collection(firestore, `workspaces/${selectedWorkspace.id}/chatMessages`),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
  }, [firestore, selectedWorkspace]);

  const { data: messages, isLoading } = useCollection<ChatMessage>(messagesQuery);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !selectedWorkspace || isSending) return;

    setIsSending(true);
    const messageText = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(firestore, `workspaces/${selectedWorkspace.id}/chatMessages`), {
        text: messageText,
        senderId: user.uid,
        senderName: profile?.name || user.displayName || user.email || 'Anonymous',
        senderAvatarUrl: profile?.avatarUrl || user.photoURL || null,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (!selectedWorkspace) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea ref={scrollRef} className="flex-1 p-4 h-full">
        <div className="space-y-6 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              Loading chat history...
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg) => {
              const isOwnMessage = msg.senderId === user?.uid;
              return (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex items-start gap-3",
                    isOwnMessage ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={msg.senderAvatarUrl ?? undefined} className="object-cover" />
                    <AvatarFallback className="text-[10px] font-bold">
                      {msg.senderName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "flex flex-col max-w-[70%]",
                    isOwnMessage ? "items-end" : "items-start"
                  )}>
                    <div className="flex items-baseline gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {msg.senderName}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                        {msg.createdAt ? format(msg.createdAt.toDate(), 'p') : '...'}
                      </span>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-2xl text-sm shadow-sm",
                      isOwnMessage 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-muted text-foreground rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Start the conversation!</p>
                <p className="text-sm text-muted-foreground">This is the beginning of the workspace chat.</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/5 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
          <Input 
            placeholder="Type a message..." 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSending}
            autoFocus
            className="bg-background shadow-inner"
          />
          <Button type="submit" disabled={isSending || !inputText.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
