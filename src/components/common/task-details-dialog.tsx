'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Task, Comment, UserProfile } from '@/lib/types';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, doc } from 'firebase/firestore';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { suggestTaskCompletion, type SuggestTaskCompletionOutput } from '@/ai/flows/suggest-task-completion-flow';

function CommentItem({ comment, path, level = 0 }: { comment: Comment; path: string; level?: number }) {
  const [showReply, setShowReply] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const [replyText, setReplyText] = useState('');
  
  const repliesPath = `${path}/${comment.id}/comments`;
  const repliesQuery = useMemoFirebase(() => query(collection(firestore, repliesPath), orderBy('createdAt', 'asc')), [firestore, repliesPath]);
  const { data: replies } = useCollection<Comment>(repliesQuery);

  const handlePostReply = async () => {
    if (!replyText.trim() || !user) return;
    const repliesCol = collection(firestore, repliesPath);
    await addDoc(repliesCol, {
      text: replyText,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      author: {
        name: user.displayName,
        avatarUrl: user.photoURL,
      }
    });
    setReplyText('');
    setShowReply(false);
  };

  return (
    <div style={{ marginLeft: `${level * 2}rem` }}>
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author?.avatarUrl ?? undefined} />
          <AvatarFallback>{comment.author?.name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{comment.author?.name}</span>
            <span className="text-xs text-muted-foreground">
              {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : 'just now'}
            </span>
          </div>
          <p className="text-sm mt-1">{comment.text}</p>
          <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setShowReply(!showReply)}>
            Reply
          </Button>
        </div>
      </div>
      {showReply && (
        <div className="mt-2 ml-11 flex flex-col gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
          />
          <div className="flex justify-end gap-2">
             <Button variant="ghost" size="sm" onClick={() => setShowReply(false)}>Cancel</Button>
             <Button size="sm" onClick={handlePostReply}>Post Reply</Button>
          </div>
        </div>
      )}
      <div className="mt-4 space-y-4">
        {replies?.map(reply => (
          <CommentItem key={reply.id} comment={reply} path={repliesPath} level={0} />
        ))}
      </div>
    </div>
  );
}

function SuggestionsSection({ task }: { task: Task }) {
  const [suggestion, setSuggestion] = useState<SuggestTaskCompletionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetSuggestion = async () => {
    setIsLoading(true);
    try {
      const result = await suggestTaskCompletion({
        title: task.title,
        description: task.description,
      });
      setSuggestion(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Assistant
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleGetSuggestion} 
          disabled={isLoading}
          className="h-8"
        >
          {isLoading ? 'Thinking...' : (suggestion ? 'Refresh Suggestion' : 'Get Help')}
        </Button>
      </div>
      
      {suggestion && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-1">
          <p className="text-sm leading-relaxed text-foreground">{suggestion.suggestion}</p>
          {suggestion.resources.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Recommended Resources</p>
              <ul className="grid grid-cols-1 gap-1">
                {suggestion.resources.map((res, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                    {res}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {!suggestion && !isLoading && (
        <p className="text-sm text-muted-foreground italic">
          Need help completing this task? Ask our AI assistant for tips and resource suggestions.
        </p>
      )}
    </div>
  );
}

function CommentsSection({ taskPath }: { taskPath: string }) {
  const [newComment, setNewComment] = useState('');
  const firestore = useFirestore();
  const { user } = useUser();
  
  const commentsPath = `${taskPath}/comments`;
  const commentsQuery = useMemoFirebase(() => query(collection(firestore, commentsPath), orderBy('createdAt', 'desc')), [firestore, commentsPath]);
  const { data: comments } = useCollection<Comment>(commentsQuery);

  const handlePostComment = async () => {
    if (!newComment.trim() || !user) return;
    const commentsCol = collection(firestore, commentsPath);
    await addDoc(commentsCol, {
      text: newComment,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      author: {
        name: user.displayName,
        avatarUrl: user.photoURL,
      }
    });
    setNewComment('');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comments</h3>
      <div className="flex flex-col gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
        />
        <Button onClick={handlePostComment} className="self-end">Post Comment</Button>
      </div>
      <Separator />
      <div className="space-y-6">
        {comments && comments.length > 0 ? (
          comments.map(comment => <CommentItem key={comment.id} comment={comment} path={commentsPath} />)
        ) : (
          <p className="text-sm text-center text-muted-foreground py-4">No comments yet. Start the conversation!</p>
        )}
      </div>
    </div>
  );
}

export function TaskDetailsDialog({ task, path, children }: { task: Task; path: string, children: React.ReactNode }) {
  const firestore = useFirestore();
  const assigneeRef = useMemoFirebase(() => doc(firestore, 'users', task.assigneeId), [firestore, task.assigneeId]);
  const { data: assignee } = useDoc<UserProfile>(assigneeRef);

  const dueDate = new Date(task.dueDate);
  const isOverdue = !task.completed && isPast(dueDate) && !isToday(dueDate);
  
  const priorityStyles = {
    low: 'bg-blue-500 hover:bg-blue-500',
    medium: 'bg-yellow-500 hover:bg-yellow-500',
    high: 'bg-red-500 hover:bg-red-500',
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{task.title}</DialogTitle>
          <DialogDescription>
            View details, collaborate, and get AI assistance for this task.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="md:col-span-2 pr-6 h-full">
                 <div className="space-y-8 pb-10">
                    <SuggestionsSection task={task} />
                    <Separator />
                    <div>
                        <h3 className="text-lg font-semibold">Description</h3>
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
                    </div>
                     <Separator />
                    <CommentsSection taskPath={path} />
                 </div>
            </ScrollArea>
            <div className="hidden md:block col-span-1 space-y-6">
                 <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Properties</h3>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Assignee</span>
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={assignee?.avatarUrl ?? undefined} />
                                    <AvatarFallback>{assignee?.name?.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{assignee?.name}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Due Date</span>
                            <Badge variant={isOverdue ? "destructive" : "outline"}>{format(dueDate, 'MMM d, yyyy')}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Priority</span>
                            <Badge className={cn(priorityStyles[task.priority], "text-primary-foreground")}>
                                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </Badge>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
