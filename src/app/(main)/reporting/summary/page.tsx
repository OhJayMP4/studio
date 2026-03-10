'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { useFirestore } from "@/firebase";
import { Company, Project, Silo, Task, UserProfile } from "@/lib/types";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Printer, ArrowLeft, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type ReportData = {
    companies: (Company & { 
        totalMinutes: number;
        projects: (Project & { 
            silos: (Silo & { 
                siloMinutes: number;
                tasks: Task[] 
            })[] 
        })[] 
    })[];
    users: { [uid: string]: UserProfile };
}

const priorityStyles: { [key: string]: string } = {
    high: 'text-red-600 font-bold',
    medium: 'text-amber-600',
    low: 'text-slate-500',
}

function ReportLoader() {
    return (
        <div className="bg-white p-8 max-w-5xl mx-auto space-y-8">
            <Skeleton className="h-12 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-64 w-full" />
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>
        </div>
    )
}

export default function SummaryReportPage() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    
    // UI State
    const [isConfiguring, setIsConfiguring] = useState(true);
    const [startDate, setStartDate] = useState<Date | undefined>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    
    // Data State
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateReport = async () => {
        if (!selectedWorkspace || !firestore || !startDate || !endDate) return;

        setIsLoading(true);
        setIsConfiguring(false);
        
        try {
            const companiesRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
            const companiesSnap = await getDocs(companiesRef);
            
            const companiesData = await Promise.all(companiesSnap.docs.map(async (companyDoc) => {
                const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
                let companyTotalMinutes = 0;
                
                const projectsRef = collection(companyDoc.ref, 'projects');
                const projectsQuery = query(projectsRef, where('status', '!=', 'archived'));
                const projectsSnap = await getDocs(projectsQuery);

                const projectsData = await Promise.all(projectsSnap.docs.map(async (projectDoc) => {
                    const project = { id: projectDoc.id, ...projectDoc.data() } as Project;

                    const silosRef = collection(projectDoc.ref, 'silos');
                    const silosSnap = await getDocs(query(silosRef, orderBy('order')));

                    const silosData = await Promise.all(silosSnap.docs.map(async (siloDoc) => {
                        const silo = { id: siloDoc.id, ...siloDoc.data() } as Silo;
                        let siloMinutes = 0;

                        const tasksRef = collection(siloDoc.ref, 'tasks');
                        const tasksSnap = await getDocs(query(tasksRef));
                        
                        // Filter tasks by date range based on due date
                        const tasksData = tasksSnap.docs
                            .map(taskDoc => ({ id: taskDoc.id, ...taskDoc.data() } as Task))
                            .filter(task => {
                                const taskDate = new Date(task.dueDate);
                                return isWithinInterval(taskDate, { 
                                    start: startOfDay(startDate), 
                                    end: endOfDay(endDate) 
                                });
                            });
                        
                        siloMinutes = tasksData.reduce((acc, t) => acc + (t.timeSpentMinutes || 0), 0);
                        companyTotalMinutes += siloMinutes;
                        
                        return { ...silo, siloMinutes, tasks: tasksData };
                    }));

                    return { ...project, silos: silosData };
                }));

                return { ...company, totalMinutes: companyTotalMinutes, projects: projectsData };
            }));

            // Filter out companies with no tasks in the range to keep report clean
            const filteredCompanies = companiesData.filter(c => c.projects.some(p => p.silos.some(s => s.tasks.length > 0)));

            const users: { [uid: string]: UserProfile } = {};
            if (selectedWorkspace.users) {
                for (const uid in selectedWorkspace.users) {
                    users[uid] = {
                        uid: uid,
                        name: selectedWorkspace.users[uid].name || 'Unknown',
                        email: null,
                        avatarUrl: selectedWorkspace.users[uid].avatarUrl || null,
                    };
                }
            }
            setReportData({ companies: filteredCompanies, users });
        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const chartData = useMemo(() => {
        if (!reportData) return [];
        return reportData.companies.map(c => ({
            name: c.name,
            hours: Math.round((c.totalMinutes / 60) * 10) / 10,
        })).sort((a, b) => b.hours - a.hours);
    }, [reportData]);

    if (isConfiguring) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                            <FileText className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-headline">Generate Weekly Summary</CardTitle>
                        <CardDescription>Select the period you would like to report on.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Start Date</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">End Date</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" size="lg" onClick={handleGenerateReport} disabled={!startDate || !endDate}>
                            Generate Report
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }
    
    if (isLoading) return <ReportLoader />;

    if (!reportData || !selectedWorkspace) {
        return (
            <div className="p-8 text-center space-y-4">
                <p className="text-muted-foreground">No data found for the selected date range.</p>
                <Button onClick={() => setIsConfiguring(true)} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Try Different Dates
                </Button>
            </div>
        );
    }

    return (
        <div className="bg-white text-slate-900 p-8 max-w-5xl mx-auto printable-area shadow-sm min-h-screen">
            <style jsx global>{`
                @media print {
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    .printable-area { box-shadow: none !important; width: 100% !important; max-width: none !important; padding: 0 !important; }
                    .break-inside-avoid { page-break-inside: avoid; }
                    @page { margin: 1.5cm; }
                }
            `}</style>

            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                 <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight">Workspace Summary</h1>
                    <p className="text-slate-500 font-medium mt-1">
                        {selectedWorkspace.name} • {format(startDate!, 'MMM d')} - {format(endDate!, 'MMM d, yyyy')}
                    </p>
                 </div>
                 <div className="flex gap-2 no-print">
                    <Button onClick={() => setIsConfiguring(true)} variant="ghost">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Change Dates
                    </Button>
                    <Button onClick={() => window.print()} className="bg-slate-900 text-white hover:bg-slate-800 shadow-md">
                        <Printer className="mr-2 h-4 w-4" /> Print Report
                    </Button>
                 </div>
            </div>

            {/* Chart Section */}
            <div className="mb-12 break-inside-avoid bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold font-headline">Resource Allocation (Hours per Company)</h2>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                interval={0}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontWeight: 500 } }}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="hours" radius={[4, 4, 0, 0]} barSize={40}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`hsl(var(--primary))`} fillOpacity={1 - (index * 0.15)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-12">
                {reportData.companies.map(company => (
                    <div key={company.id} className="mb-12">
                        <div className="flex justify-between items-baseline border-b-2 border-slate-200 pb-2 mb-6">
                            <h2 className="text-2xl font-bold text-slate-900">{company.name}</h2>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Company Total</p>
                                <p className="text-xl font-mono font-bold text-primary">{formatDuration(company.totalMinutes)}</p>
                            </div>
                        </div>

                        {company.projects.map(project => {
                            const isQuickTaskProject = project.id === 'general-tasks';
                            const projectName = isQuickTaskProject ? 'Quick Tasks' : project.name;
                            
                            return (
                                <div key={project.id} className="mb-10 pl-4 border-l-4 border-slate-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-bold text-slate-800">{projectName}</h3>
                                        {!isQuickTaskProject && (
                                            <div className="flex items-center gap-4 w-64">
                                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Progress: {project.progress}%</span>
                                                <Progress value={project.progress} className="h-2 bg-slate-100 [&>div]:bg-slate-900" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-8">
                                        {project.silos.map(silo => (
                                            silo.tasks.length > 0 && (
                                                <div key={silo.id} className="break-inside-avoid">
                                                    <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-t-lg border-x border-t border-slate-200">
                                                        <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">{silo.name}</h4>
                                                        <span className="text-xs font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200">
                                                            Silo Total: {formatDuration(silo.siloMinutes)}
                                                        </span>
                                                    </div>
                                                    <div className="border border-slate-200 rounded-b-lg overflow-hidden">
                                                        <table className="w-full text-left border-collapse text-xs">
                                                            <thead>
                                                                <tr className="bg-white border-b border-slate-200">
                                                                    <th className="p-3 font-bold text-slate-500 w-[40%]">Task</th>
                                                                    <th className="p-3 font-bold text-slate-500">Assignee</th>
                                                                    <th className="p-3 font-bold text-slate-500 text-right">Time</th>
                                                                    <th className="p-3 font-bold text-slate-500">Due Date</th>
                                                                    <th className="p-3 font-bold text-slate-500 text-center">Priority</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {silo.tasks.map(task => {
                                                                    const assignee = reportData.users[task.assigneeId]?.name || 'Unassigned';
                                                                    return (
                                                                        <tr key={task.id} className={cn("border-b border-slate-100 last:border-0", task.completed && "bg-slate-50/50")}>
                                                                            <td className="p-3">
                                                                                <p className={cn("font-medium", task.completed && "line-through text-slate-400")}>
                                                                                    {task.title}
                                                                                </p>
                                                                            </td>
                                                                            <td className="p-3 text-slate-600 font-medium">{assignee}</td>
                                                                            <td className="p-3 text-right font-mono font-bold text-slate-700">{formatDuration(task.timeSpentMinutes)}</td>
                                                                            <td className="p-3 text-slate-500">{format(new Date(task.dueDate), 'MMM d, yyyy')}</td>
                                                                            <td className="p-3 text-center">
                                                                                <span className={cn("text-[10px] uppercase font-black px-2 py-0.5 rounded-full border", 
                                                                                    task.priority === 'high' ? "bg-red-50 border-red-200 text-red-700" :
                                                                                    task.priority === 'medium' ? "bg-amber-50 border-amber-200 text-amber-700" :
                                                                                    "bg-slate-50 border-slate-200 text-slate-700"
                                                                                )}>
                                                                                    {task.priority}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs font-medium uppercase tracking-widest break-inside-avoid">
                End of Report • Generated by SaturnSync • {format(new Date(), 'PPP')}
            </div>
        </div>
    );
}
