'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { Company, Project, Silo, Task, UserProfile } from "@/lib/types";
import { collection, getDocs, query, orderBy, where, doc } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Printer, ArrowLeft, BarChart3, Building2, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    
    // Configuration State
    const [isConfiguring, setIsConfiguring] = useState(true);
    const [startDate, setStartDate] = useState<Date | undefined>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
    
    // Data State
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch available companies for selection
    const companiesListQuery = useMemoFirebase(() => {
        if (!selectedWorkspace) return null;
        return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
    }, [firestore, selectedWorkspace]);
    const { data: availableCompanies, isLoading: isLoadingCompanies } = useCollection<Company>(companiesListQuery);

    // Default to selecting all companies when they load
    useEffect(() => {
        if (availableCompanies && selectedCompanyIds.length === 0) {
            setSelectedCompanyIds(availableCompanies.map(c => c.id));
        }
    }, [availableCompanies, selectedCompanyIds.length]);

    const handleGenerateReport = async () => {
        if (!selectedWorkspace || !firestore || !startDate || !endDate || selectedCompanyIds.length === 0) return;

        setIsLoading(true);
        setIsConfiguring(false);
        
        try {
            const companiesToFetch = availableCompanies?.filter(c => selectedCompanyIds.includes(c.id)) || [];
            
            const companiesData = await Promise.all(companiesToFetch.map(async (company) => {
                let companyTotalMinutes = 0;
                
                const projectsRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', company.id, 'projects');
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
                        
                        // Filter tasks:
                        // 1. Include if due in range
                        // 2. OR include if incomplete (active work)
                        const tasksData = tasksSnap.docs
                            .map(taskDoc => ({ id: taskDoc.id, ...taskDoc.data() } as Task))
                            .filter(task => {
                                const taskDate = new Date(task.dueDate);
                                const isDueInRange = isWithinInterval(taskDate, { 
                                    start: startOfDay(startDate), 
                                    end: endOfDay(endDate) 
                                });
                                return isDueInRange || !task.completed;
                            });
                        
                        siloMinutes = tasksData.reduce((acc, t) => acc + (t.timeSpentMinutes || 0), 0);
                        companyTotalMinutes += siloMinutes;
                        
                        return { ...silo, siloMinutes, tasks: tasksData };
                    }));

                    return { ...project, silos: silosData };
                }));

                return { ...company, totalMinutes: companyTotalMinutes, projects: projectsData };
            }));

            // Filter out companies with no matching tasks to keep report clean
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

    const chartConfig = {
        hours: {
            label: "Hours",
            color: "hsl(var(--primary))",
        },
    };

    const toggleCompany = (id: string) => {
        setSelectedCompanyIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    if (isConfiguring) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl shadow-xl border-t-4 border-t-primary">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                            <FileText className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-headline">Generate Weekly Summary</CardTitle>
                        <CardDescription>Select the period and companies you would like to report on.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Reporting Period</h3>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Start Date</Label>
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
                                    <Label className="text-xs font-semibold">End Date</Label>
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

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Include Companies</h3>
                                    <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded uppercase">
                                        {selectedCompanyIds.length} Selected
                                    </span>
                                </div>
                                <ScrollArea className="h-[180px] border rounded-md p-4 bg-background">
                                    {isLoadingCompanies ? (
                                        <div className="space-y-2">
                                            <Skeleton className="h-8 w-full" />
                                            <Skeleton className="h-8 w-full" />
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {availableCompanies?.map(company => (
                                                <div key={company.id} className="flex items-center space-x-3">
                                                    <Checkbox 
                                                        id={`co-${company.id}`} 
                                                        checked={selectedCompanyIds.includes(company.id)}
                                                        onCheckedChange={() => toggleCompany(company.id)}
                                                    />
                                                    <Label htmlFor={`co-${company.id}`} className="text-sm cursor-pointer truncate flex-1">
                                                        {company.name}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col gap-3">
                        <Button className="w-full" size="lg" onClick={handleGenerateReport} disabled={!startDate || !endDate || selectedCompanyIds.length === 0}>
                            Generate Full Report
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-semibold">
                            Archived projects are automatically excluded
                        </p>
                    </CardFooter>
                </Card>
            </div>
        )
    }
    
    if (isLoading) return <ReportLoader />;

    if (!reportData || !selectedWorkspace) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="bg-muted p-6 rounded-full mb-2">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold">No Data Found</h2>
                <p className="text-muted-foreground max-w-md">No tasks or activity were found for the selected companies within this date range.</p>
                <Button onClick={() => setIsConfiguring(true)} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Adjust Settings
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
                    <p className="text-slate-500 font-medium mt-1 uppercase tracking-wide text-xs">
                        {selectedWorkspace.name} • {format(startDate!, 'MMM d')} - {format(endDate!, 'MMM d, yyyy')}
                    </p>
                 </div>
                 <div className="flex gap-2 no-print">
                    <Button onClick={() => setIsConfiguring(true)} variant="ghost" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Adjust Report
                    </Button>
                    <Button onClick={() => window.print()} size="sm" className="bg-slate-900 text-white hover:bg-slate-800 shadow-md">
                        <Printer className="mr-2 h-4 w-4" /> Print PDF
                    </Button>
                 </div>
            </div>

            {/* Chart Section */}
            <div className="mb-12 break-inside-avoid bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-bold font-headline">Resource Allocation (Hours)</h2>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate View</span>
                </div>
                <div className="h-[400px] w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={100}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                label={{ value: 'Total Hours', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' } }}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="hours" radius={[4, 4, 0, 0]} barSize={45}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`hsl(var(--primary))`} fillOpacity={1 - (index * 0.1)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-12">
                {reportData.companies.map(company => (
                    <div key={company.id} className="mb-12 break-inside-avoid">
                        <div className="flex justify-between items-baseline border-b-2 border-slate-200 pb-2 mb-6">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-6 w-6 text-slate-400" />
                                <h2 className="text-2xl font-bold text-slate-900">{company.name}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Company Total</p>
                                <p className="text-2xl font-mono font-bold text-primary">{formatDuration(company.totalMinutes)}</p>
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
                                                <span className="text-[10px] font-black text-slate-400 whitespace-nowrap uppercase">Progress: {project.progress}%</span>
                                                <Progress value={project.progress} className="h-1.5 bg-slate-100 [&>div]:bg-slate-900" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-8">
                                        {project.silos.map(silo => (
                                            silo.tasks.length > 0 && (
                                                <div key={silo.id} className="break-inside-avoid">
                                                    <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-t-lg border-x border-t border-slate-200">
                                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">{silo.name}</h4>
                                                        <span className="text-[10px] font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200 uppercase">
                                                            Silo Subtotal: {formatDuration(silo.siloMinutes)}
                                                        </span>
                                                    </div>
                                                    <div className="border border-slate-200 rounded-b-lg overflow-hidden">
                                                        <table className="w-full text-left border-collapse text-[11px]">
                                                            <thead>
                                                                <tr className="bg-white border-b border-slate-200">
                                                                    <th className="p-3 font-black uppercase tracking-wider text-slate-400 w-[35%]">Task Item</th>
                                                                    <th className="p-3 font-black uppercase tracking-wider text-slate-400">Owner</th>
                                                                    <th className="p-3 font-black uppercase tracking-wider text-slate-400 text-center">Status</th>
                                                                    <th className="p-3 font-black uppercase tracking-wider text-slate-400 text-right">Time Spent</th>
                                                                    <th className="p-3 font-black uppercase tracking-wider text-slate-400">Timeline</th>
                                                                    <th className="p-3 font-black uppercase tracking-wider text-slate-400 text-center">Priority</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {silo.tasks.map(task => {
                                                                    const assignee = reportData.users[task.assigneeId]?.name || 'Unassigned';
                                                                    return (
                                                                        <tr key={task.id} className={cn("border-b border-slate-100 last:border-0", task.completed && "bg-slate-50/30")}>
                                                                            <td className="p-3">
                                                                                <div className="flex items-center gap-2">
                                                                                    {task.completed ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Clock className="h-3 w-3 text-blue-400" />}
                                                                                    <p className={cn("font-semibold", task.completed && "line-through text-slate-400")}>
                                                                                        {task.title}
                                                                                    </p>
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-3 text-slate-600 font-medium">{assignee}</td>
                                                                            <td className="p-3 text-center">
                                                                                <span className={cn("text-[9px] uppercase font-black px-2 py-0.5 rounded-full border", 
                                                                                    task.completed ? "bg-green-50 border-green-200 text-green-700" : "bg-blue-50 border-blue-200 text-blue-700"
                                                                                )}>
                                                                                    {task.completed ? 'Completed' : 'In Progress'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-3 text-right font-mono font-bold text-slate-700">
                                                                                {task.completed ? formatDuration(task.timeSpentMinutes) : '0m'}
                                                                            </td>
                                                                            <td className="p-3 text-slate-500 font-medium">{format(new Date(task.dueDate), 'MMM d')}</td>
                                                                            <td className="p-3 text-center">
                                                                                <span className={cn("text-[9px] uppercase font-black px-2 py-0.5 rounded-full border", 
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
            <div className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] break-inside-avoid">
                Report Finalized • SaturnSync Intelligence • {format(new Date(), 'PPP')}
            </div>
        </div>
    );
}
