'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserPrefs } from '@/hooks/use-sidebar-prefs';

export default function MainRootPage() {
    const router = useRouter();
    const { prefs, loading } = useUserPrefs();

    useEffect(() => {
        if (loading) return;
        const home = prefs?.viewPrefs?.homePage ?? '/dashboard';
        router.replace(home);
    }, [prefs, loading, router]);

    return (
        <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        </div>
    );
}
