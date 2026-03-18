'use server';
/**
 * @fileOverview A flow to send app feedback to the management team.
 */

import { ai } from '@/ai/genkit';
import { Resend } from 'resend';
import { z } from 'zod';

const FeedbackInputSchema = z.object({
  userEmail: z.string().email(),
  userName: z.string(),
  rating: z.number().min(1).max(5),
  usage: z.string(),
  frustrated: z.boolean(),
  frustrationsComment: z.string().optional(),
  improvement: z.string(),
  featureRequest: z.string(),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

export async function sendFeedbackEmail(input: FeedbackInput): Promise<{ success: boolean }> {
  return sendFeedbackEmailFlow(input);
}

const sendFeedbackEmailFlow = ai.defineFlow(
  {
    name: 'sendFeedbackEmailFlow',
    inputSchema: FeedbackInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
        console.error('RESEND_API_KEY is not set.');
        throw new Error('Email server is not configured.');
    }
    
    const resend = new Resend(resendApiKey);

    const { userEmail, userName, rating, usage, frustrated, frustrationsComment, improvement, featureRequest } = input;

    try {
      await resend.emails.send({
        from: 'feedback@saturnsync.com',
        to: 'marketing@saturnmanagement.co.za',
        replyTo: userEmail,
        subject: `[SaturnSync Feedback] New response from ${userName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #FF6812; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">New App Feedback</h2>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>User:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${userEmail}</p>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; color: #888;">Overall Rating</h3>
              <p style="font-size: 24px; margin: 5px 0;">${'⭐'.repeat(rating)} (${rating}/5)</p>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; color: #888;">Primary Usage</h3>
              <p style="margin: 5px 0;">${usage}</p>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; color: #888;">Frustrations or Confusion</h3>
              <p style="margin: 5px 0;"><strong>Encountered issues:</strong> ${frustrated ? 'Yes' : 'No'}</p>
              ${frustrated && frustrationsComment ? `<p style="margin: 10px 0; padding: 10px; border-left: 4px solid #ff4d4d; background: #fff5f5;">${frustrationsComment}</p>` : ''}
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; color: #888;">Key Improvement</h3>
              <p style="margin: 5px 0;">${improvement}</p>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; color: #888;">Requested Feature</h3>
              <p style="margin: 5px 0; white-space: pre-wrap;">${featureRequest}</p>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
            <p style="font-size: 10px; color: #aaa; text-align: center;">This feedback was submitted via the SaturnSync in-app feedback tool.</p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending feedback email:', error);
      throw new Error('Failed to send feedback email.');
    }
  }
);
