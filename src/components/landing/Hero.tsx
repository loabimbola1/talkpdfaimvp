import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Headphones, Award } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Background with hero image overlay effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/30 to-background" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-8 animate-fade-in">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            Now with Nigerian language support
          </div>

          {/* Main Headline - Spitch-inspired */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight animate-slide-up">
            Turn Your PDFs Into
            <br />
            <span className="text-gradient">Interactive Audio Tutors.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Listen to your study materials in Yoruba, Hausa, Igbo, Pidgin, or English.
            Learn by explaining concepts back and earn badges.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base rounded-full px-8 h-12" asChild>
              <Link to="/auth">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 text-base rounded-full px-8 h-12">
              See How It Works
            </Button>
          </div>

          {/* Stats Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="flex flex-col items-center">
              <span className="font-display font-bold text-foreground text-3xl">300%</span>
              <span className="text-muted-foreground">Retention Boost</span>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border" />
            <div className="flex flex-col items-center">
              <span className="font-display font-bold text-foreground text-3xl">5+</span>
              <span className="text-muted-foreground">Languages</span>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border" />
            <div className="flex flex-col items-center">
              <span className="font-display font-bold text-foreground text-3xl">10K+</span>
              <span className="text-muted-foreground">Students</span>
            </div>
          </div>
        </div>

        {/* How It Works Visual */}
        <div className="max-w-4xl mx-auto mt-20 animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <div className="bg-card rounded-3xl border border-border p-8 md:p-12 shadow-elevated">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">Upload PDF</h3>
                <p className="text-sm text-muted-foreground">Drop your textbook, notes, or any study material</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Headphones className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">Listen & Learn</h3>
                <p className="text-sm text-muted-foreground">Hear summaries in your preferred Nigerian language</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Award className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">Earn Badges</h3>
                <p className="text-sm text-muted-foreground">Explain back concepts and unlock achievements</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
