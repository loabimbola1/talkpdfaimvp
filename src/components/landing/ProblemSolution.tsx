import { Headphones, Languages, Brain, ArrowRight } from "lucide-react";

const problems = [
  {
    problem: "Reading textbooks for hours",
    solution: "Listen while commuting, exercising, or relaxing",
    icon: Headphones,
  },
  {
    problem: "English-only learning materials",
    solution: "Learn in Yoruba, Hausa, Igbo, or Pidgin",
    icon: Languages,
  },
  {
    problem: "Memorizing without understanding",
    solution: "Explain-Back Mode proves you truly get it",
    icon: Brain,
  },
];

const ProblemSolution = () => {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Traditional studying is broken
          </h2>
          <p className="text-muted-foreground text-lg">
            We built TalkPDF AI to fix what's wrong with how students learn
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {problems.map((item, index) => (
            <div
              key={index}
              className="group flex flex-col md:flex-row items-center gap-4 md:gap-8 p-6 md:p-8 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-all duration-300"
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <item.icon className="h-8 w-8 text-primary" />
              </div>

              {/* Problem */}
              <div className="flex-1 text-center md:text-left">
                <p className="text-muted-foreground line-through decoration-destructive/50 text-lg">
                  {item.problem}
                </p>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-primary" />
              </div>

              {/* Solution */}
              <div className="flex-1 text-center md:text-left">
                <p className="text-foreground font-medium text-lg">
                  {item.solution}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;
