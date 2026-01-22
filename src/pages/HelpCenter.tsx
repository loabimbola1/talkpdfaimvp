import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { ArrowLeft, Search, Book, Headphones, Upload, Award, CreditCard, Settings } from "lucide-react";
import logo from "@/assets/logo.png";

const helpTopics = [
  {
    icon: Upload,
    title: "Getting Started",
    description: "Learn the basics of using TalkPDF AI",
    items: [
      {
        question: "How do I upload a PDF?",
        answer: "Navigate to your Dashboard and click on the 'Upload PDF' tab. You can drag and drop your PDF file or click to browse your files. The maximum file size is 20MB."
      },
      {
        question: "What file formats are supported?",
        answer: "Currently, TalkPDF AI only supports PDF files. We recommend converting other document formats to PDF before uploading."
      },
      {
        question: "Is there a file size limit?",
        answer: "Yes, the maximum file size is 20MB per PDF. If your file is larger, consider splitting it into smaller sections."
      }
    ]
  },
  {
    icon: Headphones,
    title: "Audio & Languages",
    description: "Everything about audio conversion and language options",
    items: [
      {
        question: "What languages are available?",
        answer: "We support 5 Nigerian languages: English, Yoruba, Hausa, Igbo, and Nigerian Pidgin (Naija)."
      },
      {
        question: "How long does audio conversion take?",
        answer: "Conversion time depends on the length of your PDF. Most documents are converted within 1-3 minutes."
      },
      {
        question: "Can I download audio for offline listening?",
        answer: "Yes! Study Pass subscribers can download audio files for offline listening."
      }
    ]
  },
  {
    icon: Book,
    title: "Explain-Back Mode",
    description: "Understanding the interactive learning feature",
    items: [
      {
        question: "What is Explain-Back Mode?",
        answer: "Explain-Back Mode is our unique feature that tests your understanding by asking you to explain concepts back in your own words. The AI then evaluates your understanding and provides feedback."
      },
      {
        question: "How does scoring work?",
        answer: "You receive a score from 0-100% based on how well you explained the concept. The AI considers accuracy, completeness, and clarity."
      },
      {
        question: "Is Explain-Back Mode available on Free plan?",
        answer: "Explain-Back Mode is available on Study Go and Study Pass plans only."
      }
    ]
  },
  {
    icon: CreditCard,
    title: "Billing & Subscriptions",
    description: "Payment and subscription information",
    items: [
      {
        question: "What payment methods do you accept?",
        answer: "We accept payments via Flutterwave, which supports bank transfers, card payments, and mobile money across Nigeria."
      },
      {
        question: "Can I cancel my subscription?",
        answer: "Yes, you can cancel anytime. Your subscription will remain active until the end of your billing period."
      },
      {
        question: "How do I upgrade my plan?",
        answer: "Go to the Pricing section and select your desired plan. You'll only be charged the difference for the remaining period."
      }
    ]
  }
];

const HelpCenter = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="TalkPDF AI" className="h-8 w-auto" />
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
            Help Center
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Find answers to common questions and learn how to get the most out of TalkPDF AI.
          </p>
        </div>
      </section>

      {/* Help Topics */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-8">
            {helpTopics.map((topic, index) => (
              <div key={index} className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <topic.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      {topic.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{topic.description}</p>
                  </div>
                </div>
                
                <Accordion type="single" collapsible className="w-full">
                  {topic.items.map((item, itemIndex) => (
                    <AccordionItem key={itemIndex} value={`item-${index}-${itemIndex}`}>
                      <AccordionTrigger className="text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>

          {/* Contact Support */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Can't find what you're looking for?
            </p>
            <Link to="/contact">
              <Button>Contact Support</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HelpCenter;
