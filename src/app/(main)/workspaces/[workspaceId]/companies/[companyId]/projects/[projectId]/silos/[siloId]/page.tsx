import { getSiloById, calculateCompletion } from "@/lib/data";
import { notFound } from "next/navigation";
import { TaskList } from "@/components/tasks/task-list";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, CheckCircle2 } from "lucide-react";

export default function SiloPage({ params }: { params: { workspaceId: string, companyId: string, projectId: string, siloId: string } }) {
    const silo = getSiloById(params.workspaceId, params.companyId, params.projectId, params.siloId);

    if (!silo) {
        notFound();
    }
    
    const completionPercentage = calculateCompletion(silo.tasks);
    const completedTasks = silo.tasks.filter(t => t.completed).length;
    const totalTasks = silo.tasks.length;

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-headline">{silo.name}</h1>
                <p className="text-muted-foreground">Manage and track tasks for this silo.</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalTasks}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{completedTasks}</div>
                    </CardContent>
                </Card>
                <Card className="col-span-1 md:col-span-2 lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                        <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
                    </CardHeader>
                    <CardContent>
                       <Progress value={completionPercentage} aria-label={`${completionPercentage}% complete`} />
                    </CardContent>
                </Card>
            </div>

            <TaskList tasks={silo.tasks} />
        </div>
    );
}
