import type { Task } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ArrowUp, ArrowDown, Minus, CheckCircle, Circle, Archive, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { useFirestore, updateDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";

const priorityIcons = {
  low: <ArrowDown className="h-4 w-4 text-green-500" />,
  medium: <Minus className="h-4 w-4 text-orange-500" />,
  high: <ArrowUp className="h-4 w-4 text-red-500" />,
};

export function TaskList({ tasks, siloId }: { tasks: Task[], siloId: string }) {
  const firestore = useFirestore();

  const handleToggleCompleted = (task: Task) => {
    if (!firestore || !siloId) return;
    const taskRef = doc(firestore, `silos/${siloId}/tasks/${task.id}`);
    updateDocumentNonBlocking(taskRef, { completed: !task.completed });
  };
  
  if (tasks.length === 0) {
      return (
          <Card className="text-center py-12">
               <CardContent>
                  <h3 className="text-lg font-medium">No Tasks Yet</h3>
                  <p className="text-muted-foreground">Get started by adding a new task to this silo.</p>
              </CardContent>
          </Card>
      );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Task Name</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} data-state={task.completed ? "completed" : "pending"}>
                <TableCell>
                  <Checkbox 
                    checked={task.completed} 
                    onCheckedChange={() => handleToggleCompleted(task)}
                    aria-label={`Mark task ${task.name} as ${task.completed ? 'incomplete' : 'complete'}`} 
                  />
                </TableCell>
                <TableCell className="font-medium">{task.name}</TableCell>
                <TableCell>
                  <Badge variant={task.completed ? "secondary" : "outline"} className="capitalize">
                     {task.completed ? <CheckCircle className="mr-1 h-3 w-3" /> : <Circle className="mr-1 h-3 w-3" />}
                    {task.completed ? "Done" : "To-do"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {priorityIcons[task.priority]}
                    <span className="capitalize">{task.priority}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                         <Archive className="mr-2 h-4 w-4" />
                        <span>Archive</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-500 focus:text-red-500">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
