'use client';

import { usePresence } from "@/hooks/use-presence";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";

export function PresenceAvatars() {
    const { activeUsers, isLoading } = usePresence();
    const MAX_AVATARS_SHOWN = 4;

    if (isLoading) {
        return (
            <div className="flex items-center -space-x-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
        );
    }
    
    if (!activeUsers || activeUsers.length === 0) {
        return null;
    }
    
    const visibleUsers = activeUsers.slice(0, MAX_AVATARS_SHOWN);
    const hiddenUsersCount = activeUsers.length - visibleUsers.length;

    const tooltipText = "Active: " + activeUsers.map(u => u.user.name).join(', ');

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center -space-x-2 pr-2">
                        {visibleUsers.map(presence => {
                            const fallback = presence.user.name.charAt(0).toUpperCase();
                            return (
                                <Avatar key={presence.id} className="h-8 w-8 border-2" style={{ borderColor: presence.color }}>
                                    <AvatarImage src={presence.user.avatarUrl ?? undefined} alt={presence.user.name} />
                                    <AvatarFallback>{fallback}</AvatarFallback>
                                </Avatar>
                            )
                        })}
                         {hiddenUsersCount > 0 && (
                            <div className="relative">
                               <Avatar className="h-8 w-8 border-2 border-border">
                                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                        +{hiddenUsersCount}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )

}
