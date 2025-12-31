import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Upload, Headphones, Award } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-hero overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-secondary/80 text-secondary-foreground rounded-full px-4 py-1.5 text-sm font-medium mb-6 animate-fade-in">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            86% Beta Slots Sold in 14 Days
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight animate-slide-up">
            Go from confusing PDF to{" "}
            <span className="text-gradient">clear understanding</span>. Fast.
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            TalkPDF AI turns textbooks into interactive tutors in your own language.{" "}
            <span className="text-foreground font-medium">
              If you hate memorizing, you'll love TalkPDF AI.
            </span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base">
              Start Learning Free
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 text-base">
              <Play className="h-4 w-4" />
              Watch Demo
            </Button>
          </div>

          {/* Social Proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-foreground text-xl">300%</span>
              <span>Retention Lift</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-foreground text-xl">5</span>
              <span>Languages Supported</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-foreground text-xl">10K+</span>
              <span>Students</span>
            </div>
          </div>
        </div>

        {/* How It Works Preview */}
        <div className="max-w-3xl mx-auto mt-16 animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <div className="grid grid-cols-3 gap-4 md:gap-8">
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Upload className="h-5 w-5 md:h-7 md:w-7 text-primary" />
              </div>
              <span className="text-xs md:text-sm font-medium text-foreground">Upload PDF</span>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Headphones className="h-5 w-5 md:h-7 md:w-7 text-primary" />
              </div>
              <span className="text-xs md:text-sm font-medium text-foreground">Listen in Your Language</span>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Award className="h-5 w-5 md:h-7 md:w-7 text-primary" />
              </div>
              <span className="text-xs md:text-sm font-medium text-foreground">Earn Badges</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
