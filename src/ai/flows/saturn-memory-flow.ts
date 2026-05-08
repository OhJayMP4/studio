'use server';

import { ai } from '@/ai/genkit';

const MAX_WORKSPACE_FACTS = 40;
const MAX_USER_PREFS = 12;
const MAX_USER_PATTERNS = 12;

type ExtractedMemory = {
  workspaceFacts: string[];
  userPreferences: string[];
  userPatterns: string[];
};

export async function extractMemoryFromConversation(params: {
  conversation: Array<{ role: string; content: string }>;
  existingWorkspaceFacts: string[];
  existingUserPreferences: string[];
  existingUserPatterns: string[];
  userName: string;
  workspaceName: string;
}): Promise<ExtractedMemory> {
  const { conversation, existingWorkspaceFacts, existingUserPreferences, existingUserPatterns, userName, workspaceName } = params;

  // Only extract from conversations with at least one exchange
  if (conversation.length < 2) return { workspaceFacts: [], userPreferences: [], userPatterns: [] };

  const conversationText = conversation
    .map(m => `${m.role === 'user' ? userName : 'Saturn'}: ${m.content}`)
    .join('\n\n');

  const { text } = await ai.generate({
    model: 'googleai/gemini-2.0-flash',
    prompt: `You are a memory extraction system for Saturn, an AI assistant embedded in a workspace management platform called "${workspaceName}".

Your job is to extract NEW facts worth remembering from a conversation. Do NOT repeat anything already in the existing memory.

EXISTING WORKSPACE FACTS (${existingWorkspaceFacts.length}/${MAX_WORKSPACE_FACTS}):
${existingWorkspaceFacts.length ? existingWorkspaceFacts.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'None yet.'}

EXISTING USER PREFERENCES (${existingUserPreferences.length}/${MAX_USER_PREFS}):
${existingUserPreferences.length ? existingUserPreferences.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'None yet.'}

EXISTING USER PATTERNS (${existingUserPatterns.length}/${MAX_USER_PATTERNS}):
${existingUserPatterns.length ? existingUserPatterns.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'None yet.'}

CONVERSATION TO ANALYSE:
${conversationText}

Extract only genuinely NEW facts. Be concise — one sentence max per fact.

CATEGORIES:
- workspaceFacts: Business context about this workspace — company details, project status, ongoing initiatives, team dynamics, important deadlines, recurring issues, sales context
- userPreferences: How ${userName} likes their responses — tone, format, level of detail, what they find useful
- userPatterns: What ${userName} frequently asks about, what matters to them, their working style, priorities

Return ONLY valid JSON. No markdown. No explanation. Exactly this shape:
{"workspaceFacts":[],"userPreferences":[],"userPatterns":[]}`,
  });

  try {
    const cleaned = (text ?? '{}').replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      workspaceFacts: Array.isArray(parsed.workspaceFacts) ? parsed.workspaceFacts.slice(0, 8) : [],
      userPreferences: Array.isArray(parsed.userPreferences) ? parsed.userPreferences.slice(0, 4) : [],
      userPatterns: Array.isArray(parsed.userPatterns) ? parsed.userPatterns.slice(0, 4) : [],
    };
  } catch {
    return { workspaceFacts: [], userPreferences: [], userPatterns: [] };
  }
}

