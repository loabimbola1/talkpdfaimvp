import { Headphones, Languages, Brain, Trophy } from "lucide-react";

const features = [
  {
    icon: Headphones,
    title: "Audio Learning",
    description:
      "Convert any PDF to natural-sounding audio. Listen during your commute, workout, or while relaxing. ElevenLabs-powered voices that sound human.",
    highlight: "150+ hours of audio generated",
  },
  {
    icon: Languages,
    title: "5 Nigerian Languages",
    description:
      "Learn in English, Yoruba, Hausa, Igbo, or Pidgin. Understanding happens faster in your native tongue. True localization, not translation.",
    highlight: "First in Nigeria",
  },
  {
    icon: Brain,
    title: "Explain-Back Mode",
    description:
      "AI validates your understanding in real-time. No more faking it—prove you truly get it. The only app that holds you accountable.",
    highlight: "300% retention boost",
  },
  {
    icon: Trophy,
    title: "Badges & Progress",
    description:
      "Earn Bronze, Silver, and Gold badges as you master concepts. Track your progress visually. Share achievements with classmates.",
    highlight: "Gamified learning",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need to
            <br />
            <span className="text-gradient">master understanding</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            The only platform that refuses to let students fake understanding
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-8 md:p-10 rounded-3xl bg-card border border-border shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-7 w-7 text-primary" />
              </div>

              {/* Highlight Badge */}
              <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent mb-4">
                {feature.highlight}
              </span>

              {/* Content */}
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
