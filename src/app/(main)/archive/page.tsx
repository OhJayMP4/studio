import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive as ArchiveIcon } from "lucide-react";

export default function ArchivePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline">Archive</h1>
                <p className="text-muted-foreground">View and manage archived tasks, silos, and projects.</p>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                        <ArchiveIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <CardTitle className="font-headline text-2xl mt-4">Archive is Empty</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        When you archive items, they will appear here.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
