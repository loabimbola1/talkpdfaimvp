import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-display font-bold text-xl text-primary">TalkPDF AI</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: January 2, 2026
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using TalkPDF AI, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                2. Description of Service
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                TalkPDF AI is an AI-powered learning platform that converts PDF documents into audio in Nigerian languages and provides interactive learning features including Explain-Back Mode. We reserve the right to modify, suspend, or discontinue any aspect of the service at any time.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                3. User Accounts
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                To use TalkPDF AI, you must create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                4. Acceptable Use
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Upload copyrighted material without authorization</li>
                <li>Use the service for any illegal purpose</li>
                <li>Attempt to reverse engineer or hack our systems</li>
                <li>Share your account credentials with others</li>
                <li>Use automated systems to access the service</li>
                <li>Upload malicious files or content</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                5. Subscription and Payments
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Paid subscriptions are billed in advance on a monthly or annual basis. All payments are processed through Flutterwave. By subscribing, you authorize us to charge your payment method for the subscription fee.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Prices are in Nigerian Naira (NGN) unless otherwise stated</li>
                <li>Subscriptions automatically renew unless cancelled</li>
                <li>Refunds are available within 7 days of purchase</li>
                <li>You can cancel your subscription at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                6. Usage Limits
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Each subscription plan has specific usage limits for PDF uploads, audio minutes, and other features. Exceeding these limits may result in temporary restrictions until your next billing cycle or plan upgrade.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                7. Intellectual Property
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                TalkPDF AI and its original content, features, and functionality are owned by us and are protected by copyright, trademark, and other intellectual property laws. You retain ownership of your uploaded documents.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                8. Disclaimer of Warranties
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                TalkPDF AI is provided "as is" without warranties of any kind. We do not guarantee that the service will be uninterrupted, error-free, or that AI-generated content will be 100% accurate. Audio conversion and translation quality may vary.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                9. Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, TalkPDF AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                10. Termination
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your account immediately, without prior notice, for any breach of these Terms. Upon termination, your right to use the service will cease immediately.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                11. Governing Law
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                12. Changes to Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of significant changes via email or through the service. Continued use after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                13. Contact
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms, please contact us at: legal@talkpdfai.com
              </p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Terms;
