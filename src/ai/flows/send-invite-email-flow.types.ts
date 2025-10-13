import { z } from 'genkit';

export const SendInviteEmailInputSchema = z.object({
  email: z.string().email(),
  workspaceName: z.string(),
  joinUrl: z.string().url(),
});

export type SendInviteEmailInput = z.infer<typeof SendInviteEmailInputSchema>;
