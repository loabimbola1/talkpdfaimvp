import { 
  Languages, 
  Wifi, 
  MessageSquare, 
  Award, 
  Zap, 
  Shield 
} from "lucide-react";

const features = [
  {
    icon: Languages,
    title: "5 Local Languages",
    description: "Learn in English, Yoruba, Hausa, Igbo, or Pidgin. Understanding happens in your native tongue.",
  },
  {
    icon: MessageSquare,
    title: "Explain-Back Mode",
    description: "AI validates your understanding in real-time. No more faking it—prove you truly get it.",
  },
  {
    icon: Award,
    title: "Badge System",
    description: "Earn Bronze, Silver, and Gold badges as you master concepts. Track your progress visually.",
  },
  {
    icon: Wifi,
    title: "Offline-First",
    description: "Download lessons and study anywhere—no internet required. Perfect for commutes.",
  },
  {
    icon: Zap,
    title: "Instant Audio",
    description: "Convert any PDF to natural-sounding audio in minutes. ElevenLabs-powered voices.",
  },
  {
    icon: Shield,
    title: "Privacy Focused",
    description: "Your documents stay private. End-to-end encryption keeps your study materials secure.",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to{" "}
            <span className="text-gradient">Master Understanding</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            The only platform that refuses to let students fake understanding while working offline in their native language.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 md:p-8 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
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
