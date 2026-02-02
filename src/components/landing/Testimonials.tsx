import { Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const testimonials = [
  {
    quote:
      "I paid immediately. Fear of failing NECO is worth ₦40k. TalkPDF AI helped me understand Chemistry in Yoruba!",
    author: "Adeola O.",
    role: "SS3 Student, Lagos",
    rating: 5,
  },
  {
    quote:
      "Finally, a tool that doesn't let me cheat myself. The Explain-Back Mode forced me to actually understand, not memorize.",
    author: "Chinedu A.",
    role: "UNILAG Engineering Student",
    rating: 5,
  },
  {
    quote:
      "I listen to my textbooks during the 2-hour commute. My grades went from C's to A's. Worth every kobo!",
    author: "Fatima M.",
    role: "UI Ibadan Medical Student",
    rating: 5,
  },
];

const Testimonials = () => {
  return (
    <section id="testimonials" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Students love TalkPDF AI
          </h2>
          <p className="text-muted-foreground text-lg">
            Join 10,000+ students who've transformed how they learn
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="p-8 rounded-3xl bg-card border border-border shadow-card hover:shadow-elevated transition-all duration-300"
            >
              {/* Author with Avatar */}
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                    {testimonial.author.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">
                    {testimonial.author}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-accent text-accent"
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-lg text-foreground leading-relaxed">
                "{testimonial.quote}"
              </blockquote>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
