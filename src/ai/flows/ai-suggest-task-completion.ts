'use server';

/**
 * @fileOverview An AI-powered tool to suggest relevant information for task completion.
 *
 * - suggestTaskCompletion - A function that suggests information for task completion.
 * - SuggestTaskCompletionInput - The input type for the suggestTaskCompletion function.
 * - SuggestTaskCompletionOutput - The return type for the suggestTaskCompletion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTaskCompletionInputSchema = z.object({
  taskDescription: z.string().describe('The description of the task.'),
  relatedDocuments: z.array(z.string()).optional().describe('List of related documents to analyze.'),
});
export type SuggestTaskCompletionInput = z.infer<typeof SuggestTaskCompletionInputSchema>;

const SuggestTaskCompletionOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('Suggestions for task completion based on the task description and related documents.'),
});
export type SuggestTaskCompletionOutput = z.infer<typeof SuggestTaskCompletionOutputSchema>;

export async function suggestTaskCompletion(input: SuggestTaskCompletionInput): Promise<SuggestTaskCompletionOutput> {
  return suggestTaskCompletionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTaskCompletionPrompt',
  input: {schema: SuggestTaskCompletionInputSchema},
  output: {schema: SuggestTaskCompletionOutputSchema},
  prompt: `You are an AI assistant designed to help users complete tasks more efficiently.

  Analyze the current task and suggest supporting information from related documents or external resources.
  Provide suggestions that are relevant and actionable.

  Task Description: {{{taskDescription}}}

  {{#if relatedDocuments}}
  Related Documents:
  {{#each relatedDocuments}}
  - {{{this}}}
  {{/each}}
  {{/if}}

  Suggestions:`, // Ensure the output aligns with SuggestTaskCompletionOutputSchema (array of strings)
});

const suggestTaskCompletionFlow = ai.defineFlow(
  {
    name: 'suggestTaskCompletionFlow',
    inputSchema: SuggestTaskCompletionInputSchema,
    outputSchema: SuggestTaskCompletionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
