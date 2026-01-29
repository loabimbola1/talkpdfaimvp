import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { ArrowLeft } from "lucide-react";

const faqs = [
  {
    category: "General",
    items: [
      {
        question: "What is TalkPDF AI?",
        answer: "TalkPDF AI is an AI-powered learning assistant designed for Nigerian students. It converts textbooks and PDFs into interactive audio tutors in local languages including English, Yoruba, Hausa, Igbo, and Nigerian Pidgin."
      },
      {
        question: "Who is TalkPDF AI for?",
        answer: "TalkPDF AI is perfect for students preparing for WAEC, JAMB, NECO, and other exams. It's designed for anyone who wants to study more effectively using audio and local languages."
      },
      {
        question: "Does it work offline?",
        answer: "Pro subscribers can download audio files for offline listening. However, initial PDF processing and Explain-Back Mode require an internet connection."
      }
    ]
  },
  {
    category: "Features",
    items: [
      {
        question: "What languages do you support?",
        answer: "We currently support 5 languages: English, Yoruba (Yorùbá), Hausa, Igbo, and Nigerian Pidgin (Naija). More languages will be added based on user demand."
      },
      {
        question: "What is Explain-Back Mode?",
        answer: "Explain-Back Mode is a unique feature that tests your understanding by asking you to explain concepts in your own words. The AI evaluates your explanation and provides feedback, helping you identify knowledge gaps."
      },
      {
        question: "How accurate is the AI voice?",
        answer: "We use advanced AI text-to-speech technology optimized for Nigerian languages. While it's highly accurate, some nuances in local accents may vary. We're continuously improving voice quality."
      }
    ]
  },
  {
    category: "Pricing & Billing",
    items: [
      {
        question: "Is there a free plan?",
        answer: "Yes! You can use our Free plan indefinitely with limited features (5 minutes of audio per day, 2 PDFs per day). Upgrade anytime to unlock more features."
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept payments via Flutterwave, which supports Nigerian bank cards, bank transfers, USSD, and mobile money."
      },
      {
        question: "Can I switch plans?",
        answer: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference. When downgrading, the change takes effect at your next billing cycle."
      },
      {
        question: "How do I cancel my subscription?",
        answer: "You can cancel your subscription anytime from your account settings. Your access continues until the end of your current billing period."
      }
    ]
  },
  {
    category: "Technical",
    items: [
      {
        question: "What file formats are supported?",
        answer: "We support PDF and Word (.docx) documents. Both formats are processed using AI for accurate text extraction and audio generation."
      },
      {
        question: "What's the maximum file size?",
        answer: "The maximum file size is 20MB per PDF. For larger files, we recommend splitting them into smaller sections."
      },
      {
        question: "How long does processing take?",
        answer: "Processing time depends on the PDF size. Most documents are processed within 1-3 minutes. Longer documents may take up to 5 minutes."
      },
      {
        question: "Is my data secure?",
        answer: "Yes, we take data security seriously. All files are encrypted in transit and at rest. We never share your data with third parties. See our Privacy Policy for more details."
      }
    ]
  }
];

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-display font-bold text-xl text-primary">TalkPDF AI</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 md:py-16 bg-secondary/30">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Quick answers to questions you may have about TalkPDF AI.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-8">
            {faqs.map((section, index) => (
              <div key={index}>
                <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                  {section.category}
                </h2>
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <Accordion type="single" collapsible className="w-full">
                    {section.items.map((item, itemIndex) => (
                      <AccordionItem 
                        key={itemIndex} 
                        value={`item-${index}-${itemIndex}`}
                        className="px-6"
                      >
                        <AccordionTrigger className="text-left py-4">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>
            ))}
          </div>

          {/* Still have questions */}
          <div className="mt-12 text-center bg-secondary/30 rounded-2xl p-8">
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              Still have questions?
            </h3>
            <p className="text-muted-foreground mb-6">
              We're here to help. Reach out to our support team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact">
                <Button>Contact Us</Button>
              </Link>
              <Link to="/help">
                <Button variant="outline">Visit Help Center</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FAQ;
