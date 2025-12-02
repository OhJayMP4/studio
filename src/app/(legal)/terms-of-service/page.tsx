import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | SaturnSync',
};

export default function TermsOfServicePage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-headline font-bold text-primary">Terms of Service</h1>
            <p className="mt-2 text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="prose prose-invert max-w-none text-muted-foreground space-y-4">
            <p>
              Please read these Terms of Service ("Terms") carefully before using the SaturnSync application (the "Service") operated by us.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">1. Accounts</h2>
            <p>
              When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">2. User Content</h2>
            <p>
              Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, or other material ("Content"). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">3. Prohibited Uses</h2>
            <p>
              You may not use the Service for any illegal or unauthorized purpose. You agree to comply with all laws, rules, and regulations applicable to your use of the Service. You are responsible for any activity that occurs through your account.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">4. Termination</h2>
            <p>
              We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">5. Limitation Of Liability</h2>
            <p>
              In no event shall SaturnSync, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">6. Changes</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
