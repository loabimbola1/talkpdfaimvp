import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-16 md:py-24 bg-primary relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-primary-foreground/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Join 10,000+ Students Mastering Understanding
          </h2>
          <p className="text-primary-foreground/80 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Stop memorizing. Start understanding. Get access to AI-powered learning in your own language.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              variant="secondary"
              className="w-full sm:w-auto gap-2 text-base bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="w-full sm:w-auto text-base border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
            >
              View Pricing
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
