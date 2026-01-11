import { Upload, Mic, Brain, Award } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your PDF",
    description: "Drop your textbook, lecture notes, or any PDF. We extract the content instantly.",
  },
  {
    number: "02",
    icon: Mic,
    title: "Ask by Voice",
    description: "Speak your question naturally. Ask in any of our 5 supported languages.",
  },
  {
    number: "03",
    icon: Brain,
    title: "Get Instant Explanation",
    description: "AI finds the answer in your PDF and explains like a patient tutor.",
  },
  {
    number: "04",
    icon: Award,
    title: "Explain Back & Earn Badges",
    description: "Prove you understand by explaining in your own words. Earn badges you can share.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-lg">
            From confused to confident in 4 simple steps
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Steps with connected line */}
          <div className="relative">
            {/* Connection line - hidden on mobile */}
            <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4">
              {steps.map((step, index) => (
                <div
                  key={step.number}
                  className="relative flex flex-col items-center text-center"
                >
                  {/* Step Number Badge */}
                  <div className="absolute -top-2 right-4 md:right-0 md:top-8 md:left-16 z-10">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold">
                      {step.number}
                    </span>
                  </div>

                  {/* Icon Circle */}
                  <div className="relative w-24 h-24 rounded-full bg-primary flex items-center justify-center mb-6 shadow-lg">
                    <step.icon className="h-10 w-10 text-primary-foreground" />
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-[200px]">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
