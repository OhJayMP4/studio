'use server';
/**
 * @fileOverview A flow to generate an AI-driven summary of team member activity for workspace reports.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TaskContextSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  companyName: z.string(),
  projectName: z.string(),
  timeSpentMinutes: z.number().optional(),
  comments: z.array(z.string()).optional(),
  completed: z.boolean(),
});

const UserSummaryInputSchema = z.object({
  userName: z.string(),
  tasks: z.array(TaskContextSchema),
});

const WorkspaceSummaryInputSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  users: z.array(UserSummaryInputSchema),
});

export type WorkspaceSummaryInput = z.infer<typeof WorkspaceSummaryInputSchema>;

const SummaryOutputSchema = z.object({
  summaries: z.array(z.object({
    userName: z.string(),
    summary: z.string().describe('A natural language summary of the user\'s work, accomplishments, and focus.'),
  })),
});

export type WorkspaceSummaryOutput = z.infer<typeof SummaryOutputSchema>;

export async function generateWorkspaceAISummary(input: WorkspaceSummaryInput): Promise<WorkspaceSummaryOutput> {
  return generateWorkspaceAISummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWorkspaceAISummaryPrompt',
  input: { schema: WorkspaceSummaryInputSchema },
  output: { schema: SummaryOutputSchema },
  prompt: `You are an expert executive assistant and project manager. 
Your goal is to write a highly professional, natural-sounding team summary for a workspace report.

The reporting period is from {{{startDate}}} to {{{endDate}}}.

For each user listed below, write a first-person style summary (as if they are reporting to their manager) that captures their focus during this SPECIFIC period:
1. How many tasks they focused on.
2. Their "main company" (the one with the most tasks or time).
3. A few specific achievements (x, y, & z) based on task titles and descriptions.
4. The specific task that took them the longest (based on timeSpentMinutes).
5. Any additional context from their task comments.

Input Data:
{{#each users}}
User: {{{userName}}}
Tasks:
{{#each tasks}}
- [{{#if completed}}DONE{{else}}IN PROGRESS{{/if}}] {{{title}}} ({{{companyName}}}) - Time: {{{timeSpentMinutes}}}m
  Description: {{{description}}}
  Comments: {{#each comments}}"{{{this}}}" {{/each}}
{{/each}}
{{/each}}

Rules:
- Keep it natural and engaging. 
- Use the person's name as the heading.
- Be concise but insightful.
- If data for "longest task" is missing (0 or null), focus on their highest priority or most complex sounding task.
- Output the summaries in the specified JSON format.`,
});

const generateWorkspaceAISummaryFlow = ai.defineFlow(
  {
    name: 'generateWorkspaceAISummaryFlow',
    inputSchema: WorkspaceSummaryInputSchema,
    outputSchema: SummaryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
