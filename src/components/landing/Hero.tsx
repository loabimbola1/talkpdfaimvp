import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative pt-28 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      {/* Background with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-hero" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Problem Statement - Atlas.org Style */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.1] animate-slide-up">
            Stop Reading.
            <br />
            <span className="text-muted-foreground">Start Understanding.</span>
          </h1>

          {/* Solution */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Turn any PDF into an audio tutor that speaks your language.
            Learn in Yoruba, Hausa, Igbo, Pidgin, or English.
          </p>

          {/* Single Focused CTA */}
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button size="lg" className="h-14 px-10 text-lg rounded-full gap-2" asChild>
              <Link to="/auth">
                Start Learning Free
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          {/* Immediate Trust */}
          <p className="mt-8 text-sm text-muted-foreground animate-slide-up" style={{ animationDelay: "0.3s" }}>
            Join 10,000+ students • No credit card required
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
