import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | SaturnSync',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-headline font-bold text-primary">Privacy Policy</h1>
            <p className="mt-2 text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="prose prose-invert max-w-none text-muted-foreground space-y-4">
            <p>
              Welcome to SaturnSync ("we," "our," or "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">1. Information We Collect</h2>
            <p>
              We may collect personal information that you provide to us directly, such as your name, email address, and profile picture when you register for an account. We also collect data you input into the application, including information about workspaces, companies, projects, and tasks.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to provide, operate, and maintain our services. This includes personalizing your experience, enabling collaboration features, communicating with you, and for security purposes.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">3. Information Sharing</h2>
            <p>
              We do not share your personal information with third parties except as necessary to provide our services (e.g., with cloud hosting providers) or as required by law. Information within a shared workspace is visible to other members of that workspace according to their permissions.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">4. Data Security</h2>
            <p>
              We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable.
            </p>
            
            <h2 className="text-2xl font-semibold text-foreground mt-6">5. Your Choices</h2>
            <p>
              You may review and change your information at any time by logging into your account settings. You may also request deletion of your account and associated data by contacting us.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-6">6. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
