
'use client';

import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";
import { useFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MigrationPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { firebaseApp } = useFirebase();

  const runMigration = async () => {
    if (!firebaseApp) {
        setResult({ error: "Firebase not initialized."});
        return;
    }
    setLoading(true);
    try {
      // Note: Make sure the region 'us-central1' matches your function's deployment region.
      const functions = getFunctions(firebaseApp, "us-central1");
      const fn = httpsCallable(functions, "backfillProjectWorkspaceIds");
      const res = await fn();
      setResult(res.data);
    } catch (err: any) {
      console.error(err);
      setResult({ error: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Project Data Migration</CardTitle>
                <CardDescription>
                    Run the one-time Cloud Function to backfill `workspaceId` and `companyId` on all existing project documents. This is necessary to fix permission errors with collection group queries.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-6">
                <Button 
                    onClick={runMigration}
                    disabled={loading}
                >
                    {loading ? "Running Migration..." : "Run Backfill Function"}
                </Button>

                {result && (
                    <div className="w-full">
                        <h3 className="font-semibold mb-2">Result:</h3>
                        <pre className="mt-2 p-4 bg-muted rounded-md text-sm overflow-auto">
                        {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
