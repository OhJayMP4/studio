'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit/zod';
import { Resend } from 'resend';

export const SendInviteEmailInputSchema = z.object({
  email: z.string().email(),
  workspaceName: z.string(),
  joinUrl: z.string().url(),
});

export type SendInviteEmailInput = z.infer<typeof SendInviteEmailInputSchema>;

export async function sendInviteEmail(input: SendInviteEmailInput): Promise<{ success: boolean }> {
  return sendInviteEmailFlow(input);
}

const sendInviteEmailFlow = ai.defineFlow(
  {
    name: 'sendInviteEmailFlow',
    inputSchema: SendInviteEmailInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    const { email, workspaceName, joinUrl } = input;

    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
        console.warn(
            'RESEND_API_KEY is not set. Skipping email sending. Email body would have been:\n',
            `To: ${email}\nSubject: You're invited to join ${workspaceName} on SaturnSync!\n\n` +
            `Click here to join: ${joinUrl}`
        );
        return { success: false };
    }
    
    const resend = new Resend(resendApiKey);

    try {
      await resend.emails.send({
        from: 'SaturnSync <onboarding@resend.dev>', // Must be a verified domain in Resend
        to: email,
        subject: `You're invited to join the "${workspaceName}" workspace on SaturnSync!`,
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 40px;">
            <h1 style="font-size: 24px;">You're Invited!</h1>
            <p style="font-size: 16px; color: #555;">You have been invited to join the <strong>${workspaceName}</strong> workspace on SaturnSync.</p>
            <a 
              href="${joinUrl}" 
              target="_blank"
              style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;"
            >
              Join Workspace
            </a>
            <p style="font-size: 12px; color: #999; margin-top: 30px;">
              If you did not expect this invitation, you can ignore this email.
            </p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending email via Resend:', error);
      // We don't want to block the user flow if the email fails, so we return success=false but don't throw.
      // In a production app, you'd add more robust error handling or a retry mechanism here.
      return { success: false };
    }
  }
);
