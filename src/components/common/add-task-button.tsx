import { PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import { AddTaskDialog } from "../tasks/add-task-dialog";

export function AddTaskButton() {
  return (
    <AddTaskDialog>
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Task
        </Button>
    </AddTaskDialog>
  );
}
