import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { CharacterCounter } from "@/components/ui/CharacterCounter";

const MAX_MESSAGE_CHARS = 4000;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Knowledge base for common questions
const knowledgeBase = [
  {
    keywords: ["upload", "pdf", "file", "how to upload"],
    answer: "To upload a PDF, go to your Dashboard and click on the 'Upload PDF' tab. You can drag and drop your PDF file or click to browse. The maximum file size is 20MB. Oya, start uploading! 📚"
  },
  {
    keywords: ["language", "languages", "yoruba", "hausa", "igbo", "pidgin"],
    answer: "TalkPDF AI supports 5 Nigerian languages: English, Yoruba (Yorùbá), Hausa, Igbo, and Nigerian Pidgin (Naija). Select your preferred language before uploading your PDF. No wahala!"
  },
  {
    keywords: ["price", "pricing", "cost", "subscription", "plan", "free"],
    answer: "We offer 3 plans:\n• Free: 5 audio minutes/day, 2 PDFs/day\n• Plus (₦3,500/month): 60 minutes, 20 PDFs, Explain-Back Mode\n• Pro (₦8,500/month): Unlimited audio, PDFs, and downloads\n\nThe annual plans save you money o!"
  },
  {
    keywords: ["explain back", "explain-back", "test", "understanding"],
    answer: "Explain-Back Mode tests your understanding by asking you to explain concepts in your own words. The AI evaluates your explanation and provides feedback - just like a good teacher! This feature is available on Plus and Pro plans."
  },
  {
    keywords: ["offline", "download", "without internet"],
    answer: "Pro subscribers can download audio files for offline listening. Go to the Audio Player tab and click the download icon. Study anywhere - even when NEPA takes light! 💡"
  },
  {
    keywords: ["cancel", "subscription", "refund"],
    answer: "You can cancel your subscription anytime from your Dashboard settings. Your access continues until the end of your billing period. Refunds are available within 7 days of purchase."
  },
  {
    keywords: ["payment", "pay", "flutterwave", "card", "bank"],
    answer: "We accept payments via Flutterwave, which supports Nigerian bank cards, bank transfers, USSD, and mobile money. All transactions are secure and encrypted. 💳"
  },
  {
    keywords: ["audio", "voice", "tts", "text to speech"],
    answer: "TalkPDF AI converts your PDF content into natural-sounding audio using advanced AI with Nigerian voices. Processing typically takes 1-3 minutes depending on document length."
  },
  {
    keywords: ["account", "login", "sign up", "register"],
    answer: "Click 'Get Started' or 'Sign In' on the homepage. You can create an account with your email address. We'll send you a confirmation email to verify your account."
  },
  {
    keywords: ["contact", "support", "help", "email"],
    answer: "Need more help? Email us at asktalkpdfai@gmail.com or use the Contact Us page. Pro subscribers get priority support with faster response times!"
  },
  // WAEC specific keywords
  {
    keywords: ["waec", "wassce", "west african"],
    answer: "TalkPDF AI is your WAEC prep partner! 📚 Upload your WAEC past questions, textbooks, and study materials. Listen to them in your preferred language, then use Explain-Back Mode to test your understanding before the exam. We support all WAEC subjects!"
  },
  // JAMB/UTME specific keywords
  {
    keywords: ["jamb", "utme", "post utme", "admission"],
    answer: "Preparing for JAMB/UTME? TalkPDF AI can help! Upload your JAMB past questions and recommended textbooks. Our AI converts them to audio so you can study on-the-go. Use Quiz Mode to test yourself on Use of English, Mathematics, and your other subjects!"
  },
  // NECO specific keywords
  {
    keywords: ["neco", "national examination"],
    answer: "NECO prep made easy! Upload your NECO past questions and textbooks. TalkPDF AI converts them to audio in Nigerian languages so you can study while doing other things. Perfect for revision before your exams!"
  },
  // Subject-specific: Sciences
  {
    keywords: ["physics", "chemistry", "biology", "science"],
    answer: "For science subjects, upload your textbook chapters and TalkPDF AI will break them down into audio summaries. The Explain-Back Mode is perfect for testing your understanding of scientific concepts, formulas, and theories!"
  },
  // Subject-specific: Mathematics
  {
    keywords: ["mathematics", "maths", "math", "calculation"],
    answer: "Mathematics made easier! While TalkPDF AI focuses on explanations and concepts, upload your maths textbooks to get audio summaries of theorems, formulas, and problem-solving approaches. Use Quiz Mode to test your knowledge!"
  },
  // Subject-specific: English
  {
    keywords: ["english", "literature", "comprehension", "essay"],
    answer: "For English and Literature, upload your texts and TalkPDF AI will help you understand themes, literary devices, and comprehension passages. The audio format helps with pronunciation and understanding of complex passages!"
  },
  // Study tips
  {
    keywords: ["study", "tips", "how to study", "prepare", "revision"],
    answer: "Study tips for Nigerian exams:\n1. Upload your textbooks chapter by chapter\n2. Listen to audio summaries during free time\n3. Use Explain-Back to test understanding\n4. Take quizzes regularly\n5. Focus on past question patterns\n\nConsistency is key, my friend! 💪"
  },
  // Chapter/page learning
  {
    keywords: ["chapter", "page", "section", "topic", "understand"],
    answer: "To study a specific chapter or topic:\n1. Upload the PDF with that content\n2. TalkPDF AI extracts key concepts automatically\n3. Listen to the audio summary\n4. Use Explain-Back Mode to test your understanding of each concept\n\nWe break down complex topics into digestible pieces!"
  },
  // Past questions
  {
    keywords: ["past question", "past paper", "previous year", "marking scheme"],
    answer: "Past questions are key to exam success! Upload your WAEC/NECO/JAMB past questions as PDFs. TalkPDF AI will help you understand the answers and explanations. Pro tip: Focus on repeated question patterns - examiners often recycle topics!"
  }
];

function findAnswer(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  for (const item of knowledgeBase) {
    const matchCount = item.keywords.filter(keyword => 
      lowerQuery.includes(keyword.toLowerCase())
    ).length;
    
    if (matchCount > 0) {
      return item.answer;
    }
  }
  
  return null;
}

export function SupportChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! 👋 I'm TalkPDF AI's support assistant. How can I help you today?\n\nI can answer questions about:\n• Uploading PDFs\n• Languages & audio\n• Pricing & subscriptions\n• Explain-Back Mode\n• And more!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check user's authentication and subscription plan
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_plan")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        if (profile?.subscription_plan) {
          setUserPlan(profile.subscription_plan);
        }
      }
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (!session) {
        setUserPlan("free");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // First try knowledge base
      const kbAnswer = findAnswer(userMessage.content);
      
      if (kbAnswer) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: kbAnswer,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Use AI for complex questions
        const { data, error } = await supabase.functions.invoke("support-chatbot", {
          body: {
            message: userMessage.content.slice(0, 4000),
            conversationHistory: messages.slice(-4).map(m => ({
              role: m.role,
              content: m.content.length > 1000 ? m.content.slice(0, 1000) + "..." : m.content
            }))
          }
        });

        if (error) throw error;

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || "I apologize, but I couldn't process your request. Please try again or contact us at asktalkpdfai@gmail.com",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm having trouble connecting right now. For immediate help, please email us at asktalkpdfai@gmail.com",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const isPremium = userPlan === "plus" || userPlan === "pro";

  // Show login prompt for unauthenticated users
  if (isAuthenticated === false) {
    return (
      <>
        {/* Floating Button */}
        <Button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
            "bg-primary hover:bg-primary/90 transition-all duration-300",
            isOpen && "scale-0 opacity-0"
          )}
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>

        {/* Login Prompt */}
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)]",
            "bg-card border border-border rounded-2xl shadow-2xl",
            "flex flex-col overflow-hidden transition-all duration-300",
            isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 h-0 pointer-events-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">TalkPDF Support</h3>
                <p className="text-xs text-muted-foreground">AI-powered assistance</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Login Content */}
          <div className="p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-foreground">Sign in to Chat</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Please sign in to access our AI support assistant and get personalized help.
            </p>
            <Button 
              onClick={() => window.location.href = "/auth"}
              className="w-full"
            >
              Sign In to Continue
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Need help without signing in?<br />
              Email us at <a href="mailto:asktalkpdfai@gmail.com" className="text-primary hover:underline">asktalkpdfai@gmail.com</a>
            </p>
          </div>
        </div>
      </>
    );
  }

  // Loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <Button
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90 transition-all duration-300"
        )}
        size="icon"
        disabled
      >
        <Loader2 className="h-6 w-6 animate-spin" />
      </Button>
    );
  }

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90 transition-all duration-300",
          isOpen && "scale-0 opacity-0"
        )}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)]",
          "bg-card border border-border rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden transition-all duration-300",
          isOpen ? "opacity-100 scale-100 h-[500px]" : "opacity-0 scale-95 h-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">TalkPDF Support</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {isPremium && <Sparkles className="h-3 w-3 text-yellow-500" />}
                {isPremium ? "Priority Support" : "Online"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                    message.role === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-secondary"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
              placeholder="Type your question..."
              className="flex-1"
              disabled={isLoading}
              maxLength={MAX_MESSAGE_CHARS}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || isLoading || input.length >= MAX_MESSAGE_CHARS}
              title={input.length >= MAX_MESSAGE_CHARS ? "Message too long" : undefined}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <CharacterCounter current={input.length} max={MAX_MESSAGE_CHARS} />
        </div>
      </div>
    </>
  );
}
