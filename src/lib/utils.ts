
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats minutes into a human-readable duration string.
 * e.g., 90 -> "1h 30m"
 */
export function formatDuration(minutes?: number): string {
    if (!minutes || minutes <= 0) return '-';
    
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}
