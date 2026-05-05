'use client';

import { UserTask } from "@/lib/types";
import { Table, TableBody, TableHeader, TableHead, TableRow } from "../ui/table";
import { TaskListItem } from "./task-list-item";


interface TaskListProps {
    tasks: UserTask[];
}

export function TaskList({ tasks }: TaskListProps) {
    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Hierarchy</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assignee</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map(task => (
                        <TaskListItem key={task.id} userTask={task} />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
