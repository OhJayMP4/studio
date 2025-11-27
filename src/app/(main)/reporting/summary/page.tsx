
'use client';
import { useSelectedWorkspace } from "@/app/(main)/layout";
import { useFirestore } from "@/firebase";
import { Company, Project, Silo, Task, UserProfile } from "@/lib/types";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type ReportData = {
    companies: (Company & { projects: (Project & { silos: (Silo & { tasks: Task[] })[] })[] })[];
    users: { [uid: string]: UserProfile };
}

const priorityStyles: { [key: string]: string } = {
    high: 'text-red-500 font-bold',
    medium: 'text-yellow-500',
    low: 'text-gray-500',
}

function ReportLoader() {
    return (
        <div className="bg-white text-black p-8 max-w-4xl mx-auto">
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-8" />
            <div className="space-y-8">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        </div>
    )
}

export default function SummaryReportPage() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!selectedWorkspace || !firestore) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const companiesRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
                const companiesSnap = await getDocs(companiesRef);
                
                const companiesData = await Promise.all(companiesSnap.docs.map(async (companyDoc) => {
                    const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
                    
                    const projectsRef = collection(companyDoc.ref, 'projects');
                    const projectsQuery = query(projectsRef, where('status', '!=', 'archived'));
                    const projectsSnap = await getDocs(projectsQuery);

                    const projectsData = await Promise.all(projectsSnap.docs.map(async (projectDoc) => {
                        const project = { id: projectDoc.id, ...projectDoc.data() } as Project;

                        const silosRef = collection(projectDoc.ref, 'silos');
                        const silosSnap = await getDocs(query(silosRef, orderBy('order')));

                        const silosData = await Promise.all(silosSnap.docs.map(async (siloDoc) => {
                            const silo = { id: siloDoc.id, ...siloDoc.data() } as Silo;

                            const tasksRef = collection(siloDoc.ref, 'tasks');
                            const tasksSnap = await getDocs(query(tasksRef));
                            const tasksData = tasksSnap.docs.map(taskDoc => ({ id: taskDoc.id, ...taskDoc.data() } as Task));
                            
                            return { ...silo, tasks: tasksData };
                        }));

                        return { ...project, silos: silosData };
                    }));

                    return { ...company, projects: projectsData };
                }));

                const users: { [uid: string]: UserProfile } = {};
                if (selectedWorkspace.users) {
                    for (const uid in selectedWorkspace.users) {
                        users[uid] = {
                            uid: uid,
                            name: selectedWorkspace.users[uid].name || 'Unknown',
                            email: null, // email is not stored in workspace data
                            avatarUrl: selectedWorkspace.users[uid].avatarUrl || null,
                        };
                    }
                }
                setReportData({ companies: companiesData, users });
            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [selectedWorkspace, firestore]);
    
    if (isLoading) {
        return <ReportLoader />;
    }

    if (!reportData || !selectedWorkspace) {
        return <div className="p-8 text-center">Please select a workspace to generate a report. If you have, there might be no data to display.</div>
    }

    return (
        <div className="bg-white text-black p-8 max-w-4xl mx-auto printable-area">
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .printable-area, .printable-area * {
                        visibility: visible;
                    }
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none;
                    }
                }
            `}</style>

            <div className="flex justify-between items-start mb-8">
                 <div>
                    <h1 className="text-3xl font-bold">Workspace Summary: {selectedWorkspace?.name}</h1>
                    <p className="text-gray-500">Generated on: {format(new Date(), 'PPP p')}</p>
                 </div>
                 <Button onClick={() => window.print()} className="no-print bg-gray-800 text-white hover:bg-gray-700">Print Report</Button>
            </div>


            {reportData.companies.map(company => (
                <div key={company.id} className="mb-12 break-inside-avoid">
                    <h2 className="text-2xl font-semibold border-b-2 border-gray-800 pb-2 mb-4">{company.name}</h2>
                    {company.projects.map(project => (
                        <div key={project.id} className="mb-8 pl-4 break-inside-avoid">
                            <h3 className="text-xl font-medium">{project.name}</h3>
                             <div className="flex items-center gap-4 my-2">
                                <span className="text-sm text-gray-600">Overall Progress: {project.progress}%</span>
                                <Progress value={project.progress} className="w-1/2 h-3 bg-gray-200 [&>div]:bg-gray-800" />
                            </div>
                            <div className="pl-4">
                                {project.silos.map(silo => (
                                     <div key={silo.id} className="mt-4 break-inside-avoid-page">
                                         <h4 className="text-lg font-medium text-gray-800">{silo.name}</h4>
                                         <table className="w-full text-left mt-2 border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-400">
                                                    <th className="p-2 w-2/5">Task</th>
                                                    <th className="p-2 w-1/5">Assignee</th>
                                                    <th className="p-2 w-1/5">Due Date</th>
                                                    <th className="p-2 w-1/5">Priority</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {silo.tasks.length > 0 ? silo.tasks.map(task => {
                                                    const isOverdue = new Date(task.dueDate) < new Date() && !task.completed;
                                                    const assignee = reportData.users[task.assigneeId]?.name || 'Unassigned';
                                                    return (
                                                        <tr key={task.id} className={`border-b border-gray-200 ${task.completed ? 'text-gray-400 line-through' : ''}`}>
                                                            <td className="p-2">{task.title}</td>
                                                            <td className="p-2">{assignee}</td>
                                                            <td className={`p-2 ${isOverdue ? 'text-red-500 font-bold' : ''}`}>{format(new Date(task.dueDate), 'MMM d, yyyy')}</td>
                                                            <td className={`p-2 font-medium ${priorityStyles[task.priority]}`}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</td>
                                                        </tr>
                                                    )
                                                }) : (
                                                    <tr>
                                                        <td colSpan={4} className="p-2 text-center text-gray-500">No tasks in this silo.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                         </table>
                                     </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {company.projects.length === 0 && <p className="text-gray-500 pl-4">No projects in this company.</p>}
                </div>
            ))}
             {reportData.companies.length === 0 && <p className="text-gray-500">No companies found in this workspace.</p>}
        </div>
    );
}
