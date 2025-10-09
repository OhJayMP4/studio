import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Rocket className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="font-headline text-3xl">Welcome to SaturnSync</CardTitle>
          <CardDescription>Your integrated workspace for seamless collaboration.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            Manage projects, tasks, and teams with real-time synchronization and AI-powered assistance.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/dashboard">Sign In & Go to Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
      <p className="mt-8 text-sm text-muted-foreground">
        A product by Firebase Studio
      </p>
    </div>
  );
}
