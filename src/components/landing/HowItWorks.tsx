import { Upload, Headphones, Brain } from "lucide-react";

const steps = [
  {
    number: "1",
    icon: Upload,
    title: "Upload Your PDF",
    description: "Drop any textbook, lecture notes, or study material",
  },
  {
    number: "2",
    icon: Headphones,
    title: "Listen & Learn",
    description: "Hear summaries in your preferred Nigerian language",
  },
  {
    number: "3",
    icon: Brain,
    title: "Explain Back",
    description: "Prove understanding and earn achievement badges",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-lg">
            From confused to confident in 3 simple steps
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Steps with connected line */}
          <div className="relative">
            {/* Connection line - hidden on mobile */}
            <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="relative flex flex-col items-center text-center"
                >
                  {/* Step Number Badge */}
                  <div className="absolute -top-3 right-1/4 md:right-auto md:left-1/2 md:ml-8 md:-top-1 z-10">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-sm font-bold">
                      {step.number}
                    </span>
                  </div>

                  {/* Icon Circle */}
                  <div className="relative w-28 h-28 rounded-full bg-primary flex items-center justify-center mb-6 shadow-lg">
                    <step.icon className="h-12 w-12 text-primary-foreground" />
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-[220px]">
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
