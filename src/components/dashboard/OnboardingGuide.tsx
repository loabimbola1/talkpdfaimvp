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
  BookOpen,
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
      "Let's take a quick tour. TalkPDF AI converts your PDFs into interactive audio lessons in Nigerian languages.",
  },
  {
    id: "upload",
    icon: Upload,
    title: "Upload Your PDFs",
    description:
      "Upload your study materials. Our AI converts them into audio lessons and creates study prompts you can explore.",
    action: "Go to Upload tab",
  },
  {
    id: "read",
    icon: BookOpen,
    title: "Read & Learn with AI",
    description:
      "Read documents page-by-page. Tap 'Explain This' for AI explanations or ask questions about any topic.",
    action: "Go to My Docs tab",
  },
  {
    id: "listen",
    icon: Headphones,
    title: "Listen & Test Yourself",
    description:
      "Listen to audio lessons, take quizzes, and use spaced repetition to remember what you learn.",
    action: "Go to My Docs tab",
  },
  {
    id: "complete",
    icon: CheckCircle,
    title: "You're All Set! 🚀",
    description:
      "Upload your first PDF and start learning. Na you go excel!",
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
      read: "documents",
      listen: "documents",
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
