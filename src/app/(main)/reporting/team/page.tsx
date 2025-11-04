'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { UserTask, UserProfile, Workspace } from '@/lib/types';
import { collection, getDocs, query, doc, getDoc } from "firebase/firestore";
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import { useSelectedWorkspace } from '@/app/(main)/layout';

type ReportData = {
    user: UserProfile;
    tasks: UserTask[];
};

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

function TeamReportContent() {
    const searchParams = useSearchParams();
    const userIds = useMemo(() => searchParams.getAll('u'), [searchParams]);
    const firestore = useFirestore();
    const { selectedWorkspace } = useSelectedWorkspace();
    const [reportData, setReportData] = useState<ReportData[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userIds.length === 0 || !firestore || !selectedWorkspace) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const data: ReportData[] = [];
                for (const userId of userIds) {
                    const userRef = doc(firestore, 'users', userId);
                    const tasksRef = collection(firestore, 'user-tasks', userId, 'tasks');
                    
                    const q = query(tasksRef, where => where('workspaceId', '==', selectedWorkspace.id));

                    const [userSnap, tasksSnap] = await Promise.all([
                        getDoc(userRef),
                        getDocs(q)
                    ]);

                    const user = userSnap.exists() 
                        ? { id: userSnap.id, ...userSnap.data() } as UserProfile 
                        : { uid: userId, name: 'Unknown User', email: null, avatarUrl: null };
                    
                    const tasks = tasksSnap.docs
                        .map(d => ({ id: d.id, ...d.data() } as UserTask))
                        .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                    data.push({ user, tasks });
                }
                setReportData(data);
            } catch (error) {
                console.error("Error fetching team report data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [userIds, firestore, selectedWorkspace]);
    
    if (isLoading) {
        return <ReportLoader />;
    }

    if (!reportData || reportData.length === 0) {
        return <div className="p-8 text-center">No data found for the selected team members.</div>
    }

    return (
        <div className="bg-white text-black p-8 max-w-4xl mx-auto printable-area">
            <style jsx global>{`
                @media print {
                    body {
                         -webkit-print-color-adjust: exact;
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
                    <h1 className="text-3xl font-bold">Team Task Report for {selectedWorkspace?.name}</h1>
                    <p className="text-gray-500">Generated on: {format(new Date(), 'PPP p')}</p>
                 </div>
                 <Button onClick={() => window.print()} className="no-print bg-gray-800 text-white hover:bg-gray-700">Print Report</Button>
            </div>

            {reportData.map(({ user, tasks }) => (
                <div key={user.uid} className="mb-12 break-inside-avoid">
                    <h2 className="text-2xl font-semibold border-b-2 border-gray-800 pb-2 mb-4">Tasks for {user.name}</h2>
                    {tasks.length > 0 ? (
                        <table className="w-full text-left mt-2 border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-gray-400">
                                    <th className="p-2 w-2/6">Task</th>
                                    <th className="p-2 w-2/6">Path</th>
                                    <th className="p-2 w-1/6">Due Date</th>
                                    <th className="p-2 w-1/6">Priority</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map(task => {
                                    const isOverdue = new Date(task.dueDate) < new Date() && !task.completed;
                                    return (
                                        <tr key={task.id} className={cn('border-b border-gray-200 align-top', { 'text-gray-400 bg-gray-50 line-through': task.completed })}>
                                            <td className="p-2">
                                                <p className="font-medium">{task.title}</p>
                                                {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                                            </td>
                                            <td className="p-2 text-xs text-gray-600">
                                                {task.companyName} / {task.projectName} / {task.siloName}
                                            </td>
                                            <td className={cn('p-2', { 'text-red-500 font-bold': isOverdue })}>{format(new Date(task.dueDate), 'MMM d, yyyy')}</td>
                                            <td className={cn('p-2 font-medium', priorityStyles[task.priority])}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                         <p className="pl-4 text-gray-500">No tasks assigned to this user in this workspace.</p>
                    )}
                </div>
            ))}
        </div>
    );
}


export default function TeamReportPage() {
    return (
        <Suspense fallback={<ReportLoader />}>
            <TeamReportContent />
        </Suspense>
    );
}
