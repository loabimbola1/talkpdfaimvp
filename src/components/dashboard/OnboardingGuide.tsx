import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Headphones,
  Brain,
  HelpCircle,
  Award,
  Users,
  Trophy,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
} from "lucide-react";

interface OnboardingStep {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "Welcome to TalkPDF AI! 🎉",
    description:
      "Let's take a quick tour to help you get started with your learning journey. TalkPDF AI converts your PDFs into interactive audio lessons in Nigerian languages.",
  },
  {
    id: "upload",
    icon: Upload,
    title: "Upload Your PDFs",
    description:
      "Start by uploading your study materials, textbooks, or notes. We support PDFs up to 20MB. Choose your preferred audio language - English, Yoruba, Hausa, Igbo, or Pidgin.",
    action: "Go to Upload tab",
  },
  {
    id: "listen",
    icon: Headphones,
    title: "Listen & Learn",
    description:
      "Once processed, your documents become audio lessons. Listen while commuting, exercising, or relaxing. The audio auto-pauses at key points so you can reflect on what you've learned.",
    action: "Go to Listen tab",
  },
  {
    id: "explain",
    icon: Brain,
    title: "Explain-Back Mode",
    description:
      "Test your understanding by explaining concepts in your own words - just like teaching a friend! Use your voice or type. Our AI evaluates your explanation and awards badges based on your performance.",
    action: "Go to Explain-Back tab",
  },
  {
    id: "quiz",
    icon: HelpCircle,
    title: "Quiz Yourself",
    description:
      "Challenge yourself with AI-generated quizzes based on your documents. Multiple choice, true/false, and fill-in-the-blank questions help reinforce your learning.",
    action: "Go to Quiz tab",
  },
  {
    id: "badges",
    icon: Award,
    title: "Earn Badges & Share",
    description:
      "Earn Bronze, Silver, and Gold Scholar badges for your achievements. Share your badges on WhatsApp, Twitter, and LinkedIn to celebrate with friends!",
    action: "Go to Badges tab",
  },
  {
    id: "groups",
    icon: Users,
    title: "Study Groups",
    description:
      "Create or join study groups to collaborate with classmates. Share documents and study together for exams like WAEC and JAMB.",
    action: "Go to Groups tab",
  },
  {
    id: "leaderboard",
    icon: Trophy,
    title: "Campus Leaderboards",
    description:
      "Compete with students from your university! Set your university in Settings to appear on the campus leaderboard and see how you rank among your peers.",
    action: "Go to Leaderboard tab",
  },
  {
    id: "complete",
    icon: CheckCircle,
    title: "You're All Set! 🚀",
    description:
      "You now know the basics of TalkPDF AI. Start by uploading your first PDF and experience a new way of learning. Na you go top that leaderboard!",
  },
];

interface OnboardingGuideProps {
  onComplete: () => void;
  onNavigate: (tab: string) => void;
}

const OnboardingGuide = ({ onComplete, onNavigate }: OnboardingGuideProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem("talkpdf-onboarding-completed");
    if (!hasCompletedOnboarding) {
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("talkpdf-onboarding-completed", "true");
    setIsOpen(false);
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem("talkpdf-onboarding-completed", "true");
    setIsOpen(false);
    onComplete();
  };

  const handleAction = () => {
    const step = onboardingSteps[currentStep];
    const tabMap: Record<string, string> = {
      upload: "upload",
      listen: "listen",
      explain: "explain",
      quiz: "quiz",
      badges: "badges",
      groups: "groups",
      leaderboard: "leaderboard",
    };
    
    if (tabMap[step.id]) {
      handleComplete();
      onNavigate(tabMap[step.id]);
    }
  };

  const step = onboardingSteps[currentStep];
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;
  const IconComponent = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <IconComponent className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">{step.title}</DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="py-4">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Step {currentStep + 1} of {onboardingSteps.length}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5 pb-2">
          {onboardingSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentStep
                  ? "bg-primary"
                  : index < currentStep
                  ? "bg-primary/50"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious} className="gap-1 flex-1 sm:flex-none">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {currentStep === 0 && (
              <Button variant="ghost" onClick={handleSkip} className="flex-1 sm:flex-none">
                Skip Tour
              </Button>
            )}
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {step.action && (
              <Button variant="outline" onClick={handleAction} className="flex-1 sm:flex-none">
                {step.action}
              </Button>
            )}
            <Button onClick={handleNext} className="gap-1 flex-1 sm:flex-none">
              {currentStep === onboardingSteps.length - 1 ? "Get Started" : "Next"}
              {currentStep < onboardingSteps.length - 1 && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingGuide;
