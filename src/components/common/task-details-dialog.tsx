'use client';
import { useState, useMemo } from 'react';
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
import type { Task, Comment, UserProfile, Company, Project, Silo } from '@/lib/types';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, doc } from 'firebase/firestore';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Sparkles, CheckCircle2, Clock, CalendarIcon, Building2, Folder, Layout, User as UserIcon, ShieldCheck, Settings2, Trash2 } from 'lucide-react';
import { suggestTaskCompletion, type SuggestTaskCompletionOutput } from '@/ai/flows/suggest-task-completion-flow';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { Checkbox } from '../ui/checkbox';
import { TaskCompletionDialog } from './task-completion-dialog';
import { updateTaskCompletion, deleteTask } from '@/lib/tasks';
import { useToast } from '@/hooks/use-toast';
import { EditTaskDialog } from './edit-task-dialog';
import { DeleteDialog } from './delete-dialog';

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

interface PropertyRowProps {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}

function PropertyRow({ icon, label, value }: PropertyRowProps) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                {icon}
                <span>{label}</span>
            </div>
            <div className="pl-6 text-sm font-medium text-foreground">
                {value}
            </div>
        </div>
    );
}

export function TaskDetailsDialog({ task, path, children }: { task: Task; path: string, children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const { selectedWorkspace } = useSelectedWorkspace();
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const { toast } = useToast();

  // Parse path for hierarchy details
  const pathParts = useMemo(() => path.split('/'), [path]);
  const workspaceId = pathParts[1];
  const companyId = pathParts[3];
  const projectId = pathParts[5];
  const siloId = pathParts[7];

  // Fetch Hierarchy Docs
  const companyRef = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !companyId) return null;
    return doc(firestore, 'workspaces', workspaceId, 'companies', companyId);
  }, [firestore, workspaceId, companyId]);
  const { data: company } = useDoc<Company>(companyRef);

  const projectRef = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !companyId || !projectId) return null;
    return doc(firestore, 'workspaces', workspaceId, 'companies', companyId, 'projects', projectId);
  }, [firestore, workspaceId, companyId, projectId]);
  const { data: project } = useDoc<Project>(projectRef);

  const siloRef = useMemoFirebase(() => {
    if (!firestore || !workspaceId || !companyId || !projectId || !siloId) return null;
    return doc(firestore, 'workspaces', workspaceId, 'companies', companyId, 'projects', projectId, 'silos', siloId);
  }, [firestore, workspaceId, companyId, projectId, siloId]);
  const { data: silo } = useDoc<Silo>(siloRef);

  // Fetch Users
  const assigneeRef = useMemoFirebase(() => {
    if (!firestore || !task.assigneeId) return null;
    return doc(firestore, 'users', task.assigneeId);
  }, [firestore, task.assigneeId]);
  const { data: assignee } = useDoc<UserProfile>(assigneeRef);

  const creatorRef = useMemoFirebase(() => {
    if (!firestore || !task.createdBy) return null;
    return doc(firestore, 'users', task.createdBy);
  }, [firestore, task.createdBy]);
  const { data: creator } = useDoc<UserProfile>(creatorRef);

  const dueDate = new Date(task.dueDate);
  const isOverdue = !task.completed && isPast(dueDate) && !isToday(dueDate);
  
  const priorityStyles = {
    low: 'bg-blue-500 hover:bg-blue-500',
    medium: 'bg-yellow-500 hover:bg-yellow-500',
    high: 'bg-red-500 hover:bg-red-500',
  }

  const handleStatusToggle = async (checked: boolean) => {
    if (checked) {
        if (selectedWorkspace?.isTimeTrackingEnabled) {
            setShowCompletionDialog(true);
        } else {
            await updateTaskCompletion(firestore, path, task.assigneeId, task.id, true, 0);
        }
    } else {
        await updateTaskCompletion(firestore, path, task.assigneeId, task.id, false, 0);
    }
  }

  const onConfirmCompletion = async (minutes: number) => {
    await updateTaskCompletion(firestore, path, task.assigneeId, task.id, true, minutes);
  }

  const handleDelete = async () => {
      try {
          await deleteTask(firestore, path, task.id, task.assigneeId);
          toast({ title: "Task Deleted", description: `"${task.title}" has been deleted.` });
          setOpen(false);
      } catch (error: any) {
          toast({ variant: 'destructive', title: "Delete Failed", description: error.message });
      }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/10 shrink-0">
            <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-3">
                    {task.completed ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <Clock className="text-blue-500 h-5 w-5" />}
                    {task.title}
                </DialogTitle>
                <DialogDescription className="mt-0.5">
                    Viewing task in {project?.name || '...'}
                </DialogDescription>
            </div>
        </div>

        <div className="flex flex-1 min-h-0">
            <ScrollArea className="flex-1 p-6 border-r h-full">
                 <div className="space-y-10 pb-10">
                    <SuggestionsSection task={task} />
                    
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Layout className="h-5 w-5 text-muted-foreground" />
                            Description
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap pl-7">
                            {task.description || 'No description provided.'}
                        </p>
                    </div>

                    <CommentsSection taskPath={path} />
                 </div>
            </ScrollArea>

            <aside className="w-[320px] shrink-0 bg-muted/5 p-6 h-full overflow-y-auto">
                <div className="space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Manage Task</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <EditTaskDialog task={task} path={path}>
                                <Button variant="outline" size="sm" className="w-full justify-start h-9">
                                    <Settings2 className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                            </EditTaskDialog>
                            <DeleteDialog onConfirm={handleDelete} itemName={task.title}>
                                <Button variant="outline" size="sm" className="w-full justify-start h-9 text-destructive hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </DeleteDialog>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Task Control</h3>
                        <div className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors", task.completed ? "bg-green-500/5 border-green-500/20" : "bg-background border-border")}>
                            <Checkbox 
                                id="dialog-status" 
                                checked={task.completed} 
                                onCheckedChange={handleStatusToggle}
                                className="h-5 w-5"
                            />
                            <label htmlFor="dialog-status" className="text-sm font-bold cursor-pointer">
                                {task.completed ? "Completed" : "Mark as Complete"}
                            </label>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Details & Properties</h3>
                        
                        <div className="space-y-5">
                            <PropertyRow 
                                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                                label="Status"
                                value={
                                    <Badge variant={task.completed ? "secondary" : "outline"} className="capitalize">
                                        {task.completed ? "Done" : "In Progress"}
                                    </Badge>
                                }
                            />

                            <PropertyRow 
                                icon={<UserIcon className="h-3.5 w-3.5" />}
                                label="Assignee"
                                value={
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={assignee?.avatarUrl ?? undefined} />
                                            <AvatarFallback className="text-[10px]">{assignee?.name?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{assignee?.name || 'Unassigned'}</span>
                                    </div>
                                }
                            />

                            <PropertyRow 
                                icon={<CalendarIcon className="h-3.5 w-3.5" />}
                                label="Due Date"
                                value={<Badge variant={isOverdue ? "destructive" : "outline"}>{format(dueDate, 'MMM d, yyyy')}</Badge>}
                            />

                            <PropertyRow 
                                icon={<Sparkles className="h-3.5 w-3.5" />}
                                label="Priority"
                                value={
                                    <Badge className={cn(priorityStyles[task.priority], "text-primary-foreground text-[10px] uppercase font-bold")}>
                                        {task.priority}
                                    </Badge>
                                }
                            />

                            <Separator className="my-2" />

                            <PropertyRow 
                                icon={<Building2 className="h-3.5 w-3.5" />}
                                label="Company"
                                value={company?.name || '...'}
                            />

                            <PropertyRow 
                                icon={<Folder className="h-3.5 w-3.5" />}
                                label="Project"
                                value={project?.name || '...'}
                            />

                            <PropertyRow 
                                icon={<Layout className="h-3.5 w-3.5" />}
                                label="Silo"
                                value={silo?.name || '...'}
                            />

                            <Separator className="my-2" />

                            <PropertyRow 
                                icon={<UserIcon className="h-3.5 w-3.5" />}
                                label="Created By"
                                value={
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={creator?.avatarUrl ?? undefined} />
                                            <AvatarFallback className="text-[10px]">{creator?.name?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-muted-foreground">{creator?.name || '...'}</span>
                                    </div>
                                }
                            />

                            <PropertyRow 
                                icon={<Clock className="h-3.5 w-3.5" />}
                                label="Created"
                                value={
                                    <span className="text-xs text-muted-foreground">
                                        {task.createdAt ? format(task.createdAt.toDate(), 'PP p') : 'Unknown'}
                                    </span>
                                }
                            />
                        </div>
                    </div>
                </div>
            </aside>
        </div>
      </DialogContent>
    </Dialog>

    <TaskCompletionDialog 
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        onConfirm={onConfirmCompletion}
        taskTitle={task.title}
    />
    </>
  );
}
