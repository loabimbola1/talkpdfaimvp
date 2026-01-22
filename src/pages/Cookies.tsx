import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Cookies = () => {
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
            Cookie Policy
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: January 2, 2026
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                1. What Are Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies are small text files that are stored on your device when you visit a website. They help websites remember your preferences and improve your browsing experience.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                2. How We Use Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                TalkPDF AI uses cookies for the following purposes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Essential Cookies:</strong> Required for the website to function properly, including authentication and session management</li>
                <li><strong>Preference Cookies:</strong> Remember your settings like language preference and theme choice</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our site so we can improve it</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                3. Types of Cookies We Use
              </h2>
              
              <div className="space-y-4">
                <div className="bg-secondary/30 rounded-xl p-4">
                  <h3 className="font-medium text-foreground mb-2">Session Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    Temporary cookies that are deleted when you close your browser. Used for authentication and security.
                  </p>
                </div>
                
                <div className="bg-secondary/30 rounded-xl p-4">
                  <h3 className="font-medium text-foreground mb-2">Persistent Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    Cookies that remain on your device for a set period. Used to remember your preferences.
                  </p>
                </div>
                
                <div className="bg-secondary/30 rounded-xl p-4">
                  <h3 className="font-medium text-foreground mb-2">Third-Party Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    Cookies set by our service providers like payment processors and analytics services.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                4. Managing Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Most web browsers allow you to control cookies through their settings. You can usually find these settings in the "Options" or "Preferences" menu of your browser. Please note that disabling certain cookies may affect the functionality of TalkPDF AI.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                5. Updates to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                6. Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about our use of cookies, please contact us at: privacy@talkpdfai.com
              </p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Cookies;
