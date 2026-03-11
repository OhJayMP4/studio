'use server';
/**
 * @fileOverview A task completion assistant AI agent.
 * 
 * - suggestTaskCompletion - A function that suggests helpful information for a task.
 * - SuggestTaskCompletionInput - The input type for the suggestTaskCompletion function.
 * - SuggestTaskCompletionOutput - The return type for the suggestTaskCompletion function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestTaskCompletionInputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
});
export type SuggestTaskCompletionInput = z.infer<typeof SuggestTaskCompletionInputSchema>;

const SuggestTaskCompletionOutputSchema = z.object({
  suggestion: z.string().describe('The AI-generated suggestion for task completion.'),
  resources: z.array(z.string()).describe('A list of suggested external resource types or general links.'),
});
export type SuggestTaskCompletionOutput = z.infer<typeof SuggestTaskCompletionOutputSchema>;

export async function suggestTaskCompletion(input: SuggestTaskCompletionInput): Promise<SuggestTaskCompletionOutput> {
  return suggestTaskCompletionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTaskCompletionPrompt',
  input: { schema: SuggestTaskCompletionInputSchema },
  output: { schema: SuggestTaskCompletionOutputSchema },
  prompt: `You are an expert project management assistant.
Your goal is to evaluate the following task and suggest supporting information, steps, or resources to help the user complete it efficiently.

Task Title: {{{title}}}
Task Description: {{{description}}}

Provide a concise, actionable suggestion and a few resource types (like "official documentation for React" or "best practices for logo design") that the user should look for.`,
});

const suggestTaskCompletionFlow = ai.defineFlow(
  {
    name: 'suggestTaskCompletionFlow',
    inputSchema: SuggestTaskCompletionInputSchema,
    outputSchema: SuggestTaskCompletionOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
