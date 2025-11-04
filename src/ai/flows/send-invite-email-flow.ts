'use server';

import { ai } from '@/ai/genkit';
import { Resend } from 'resend';
import { SendInviteEmailInputSchema, type SendInviteEmailInput } from './send-invite-email-flow.types';
import { z } from 'genkit';


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

    // This will correctly access the environment variable from apphosting.yaml
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
        console.warn(
            'RESEND_API_KEY is not set in environment variables. Cannot send email.'
        );
        return { success: false };
    }
    
    const resend = new Resend(resendApiKey);

    try {
      await resend.emails.send({
        from: 'onboarding@saturnsync.com',
        to: email,
        subject: `You're invited to join the "${workspaceName}" workspace on SaturnSync!`,
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 40px;">
            <h1 style="font-size: 24px;">You're Invited!</h1>
            <p style="font-size: 16px; color: #555;">You have been invited to join the <strong>${workspaceName}</strong> workspace on SaturnSync.</p>
            <a 
              href="${joinUrl}" 
              target="_blank"
              style="display: inline-block; background-color: #FF6812; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;"
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
      return { success: false };
    }
  }
);
