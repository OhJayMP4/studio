"use client";

import { suggestTaskCompletion } from "@/ai/flows/ai-suggest-task-completion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wand2 } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "../ui/skeleton";

interface AiTaskSuggesterProps {
  taskDescription: string;
}

export function AiTaskSuggester({ taskDescription }: AiTaskSuggesterProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { toast } = useToast();

  const getSuggestions = async () => {
    if (!taskDescription) {
      toast({
        variant: "destructive",
        title: "No description provided",
        description: "Please enter a task description to get AI suggestions.",
      });
      return;
    }
    setLoading(true);
    setSuggestions([]);
    try {
      const result = await suggestTaskCompletion({ taskDescription });
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error("AI suggestion error:", error);
      toast({
        variant: "destructive",
        title: "AI Suggestion Failed",
        description: "Could not fetch suggestions at this time.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        onClick={getSuggestions}
        disabled={loading}
      >
        <Wand2 className="mr-2 h-4 w-4" />
        {loading ? "Getting suggestions..." : "Get AI Suggestions"}
      </Button>

      {loading && (
        <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-4 w-[90%]" />
        </div>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="mb-2 font-medium text-sm">Suggestions</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
