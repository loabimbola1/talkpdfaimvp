import { Upload, Headphones, MessageCircle, Award } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your PDF",
    description: "Drop any textbook, lecture notes, or study material. We support up to 500 pages per document.",
  },
  {
    number: "02",
    icon: Headphones,
    title: "Listen in Your Language",
    description: "Choose from English, Yoruba, Hausa, Igbo, or Pidgin. Natural AI voices make learning feel conversational.",
  },
  {
    number: "03",
    icon: MessageCircle,
    title: "Explain Back to AI",
    description: "After each section, explain what you learned. Our AI validates your understanding in real-time.",
  },
  {
    number: "04",
    icon: Award,
    title: "Earn Your Badges",
    description: "Progress from Bronze to Silver to Gold. Share your achievements and prove your mastery.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            How TalkPDF AI Works
          </h2>
          <p className="text-muted-foreground text-lg">
            From confused to confident in four simple steps.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-2 md:gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative flex gap-4 md:gap-6 p-6 rounded-2xl bg-card border border-border shadow-card"
              >
                {/* Step Number */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                    <step.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-primary tracking-wider uppercase mb-1 block">
                    Step {step.number}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Connector Line (hidden on mobile) */}
                {index < steps.length - 1 && index % 2 === 0 && (
                  <div className="hidden md:block absolute -right-4 lg:-right-6 top-1/2 w-8 lg:w-12 h-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
