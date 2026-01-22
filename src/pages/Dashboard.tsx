import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Upload, Headphones, Award, Settings, User, FileText, Brain, Crown, Trophy, HelpCircle, BookOpen, BarChart3, Users, Calendar, School, WifiOff, Gift, Coins } from "lucide-react";
import PDFUpload from "@/components/dashboard/PDFUpload";
import AudioPlayer from "@/components/dashboard/AudioPlayer";
import MyDocuments from "@/components/dashboard/MyDocuments";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
import ExplainBackMode from "@/components/dashboard/ExplainBackMode";
import UsageLimitsDisplay from "@/components/dashboard/UsageLimitsDisplay";
import CreditsUsageTracker from "@/components/dashboard/CreditsUsageTracker";
import ReferralLeaderboard from "@/components/dashboard/ReferralLeaderboard";
import SubscriptionPlans from "@/components/dashboard/SubscriptionPlans";
import BadgesDisplay from "@/components/dashboard/BadgesDisplay";
import Leaderboard from "@/components/dashboard/Leaderboard";
import QuizLeaderboard from "@/components/dashboard/QuizLeaderboard";
import CampusTab from "@/components/dashboard/CampusTab";
import QuizMode from "@/components/dashboard/QuizMode";
import MicroLessons from "@/components/dashboard/MicroLessons";
import ProgressDashboard from "@/components/dashboard/ProgressDashboard";
import StudyGroups from "@/components/dashboard/StudyGroups";
import SpacedRepetition from "@/components/dashboard/SpacedRepetition";
import OnboardingGuide from "@/components/dashboard/OnboardingGuide";
import OfflineAudioManager from "@/components/dashboard/OfflineAudioManager";
import { ReferralProgram } from "@/components/dashboard/ReferralProgram";
import FeatureGate from "@/components/dashboard/FeatureGate";
import ThemeToggle from "@/components/ThemeToggle";
import { usePdfCompleteNotification } from "@/hooks/usePdfCompleteNotification";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type TabType = "upload" | "documents" | "listen" | "explain" | "quiz" | "lessons" | "progress" | "badges" | "leaderboard" | "quiz-leaders" | "campus" | "groups" | "review" | "subscription" | "offline" | "referral" | "settings";

const Dashboard = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("upload");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedPromptIndex, setSelectedPromptIndex] = useState<number>(0);
  const [badgeRefreshKey, setBadgeRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle deep linking from URL params
  useEffect(() => {
    const tab = searchParams.get("tab");
    const docId = searchParams.get("doc");
    const promptIndex = searchParams.get("prompt");
    
    if (tab && ["upload", "documents", "listen", "explain", "quiz", "lessons", "progress", "badges", "leaderboard", "subscription", "referral", "settings"].includes(tab)) {
      setActiveTab(tab as TabType);
    }
    if (docId) {
      setSelectedDocumentId(docId);
    }
    if (promptIndex) {
      setSelectedPromptIndex(parseInt(promptIndex, 10));
    }
  }, [searchParams]);

  // Listen for navigation events from settings
  useEffect(() => {
    const handleNavigateToTab = (event: CustomEvent<{ tab: string }>) => {
      if (event.detail?.tab) {
        setActiveTab(event.detail.tab as TabType);
      }
    };
    window.addEventListener("navigateToTab", handleNavigateToTab as EventListener);
    return () => window.removeEventListener("navigateToTab", handleNavigateToTab as EventListener);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Subscribe to PDF completion notifications
  const { subscribeToDocumentUpdates } = usePdfCompleteNotification();
  
  useEffect(() => {
    if (user?.id) {
      const unsubscribe = subscribeToDocumentUpdates(user.id, (doc) => {
        toast.success(`"${doc.title}" is ready to listen!`, {
          action: {
            label: "Listen Now",
            onClick: () => {
              setSelectedDocumentId(doc.id);
              setActiveTab("listen");
            }
          }
        });
      });
      return unsubscribe;
    }
  }, [user?.id, subscribeToDocumentUpdates]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Error signing out");
    else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  const handleSelectDocument = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setActiveTab("listen");
  };

  // Handler for AudioPlayer's explain-back trigger
  const handleExplainBackTrigger = useCallback((documentId: string, promptIndex: number) => {
    setSelectedDocumentId(documentId);
    setSelectedPromptIndex(promptIndex);
    setActiveTab("explain");
    toast.info("Let's test your understanding of this concept!", { duration: 3000 });
  }, []);

  const handleDocumentProcessed = useCallback((documentId: string) => {
    // Auto-navigate to Explain-Back with the newly processed document
    setSelectedDocumentId(documentId);
    setActiveTab("explain");
    toast.success("Document ready! Let's test your understanding.", { duration: 4000 });
  }, []);

  const handleBadgeEarned = useCallback(() => {
    setBadgeRefreshKey((prev) => prev + 1);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    toast.success("Welcome to TalkPDF AI! Upload your first PDF to get started.");
  }, []);

  const handleOnboardingNavigate = useCallback((tab: string) => {
    setActiveTab(tab as TabType);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const tabs = [
    { id: "upload" as TabType, label: "Upload PDF", icon: Upload },
    { id: "documents" as TabType, label: "My Documents", icon: FileText },
    { id: "listen" as TabType, label: "Listen", icon: Headphones },
    { id: "explain" as TabType, label: "Explain-Back", icon: Brain },
    { id: "quiz" as TabType, label: "Quiz", icon: HelpCircle },
    { id: "lessons" as TabType, label: "Lessons", icon: BookOpen },
    { id: "review" as TabType, label: "Review", icon: Calendar },
    { id: "progress" as TabType, label: "Progress", icon: BarChart3 },
    { id: "badges" as TabType, label: "Badges", icon: Award },
    { id: "groups" as TabType, label: "Groups", icon: Users },
    { id: "leaderboard" as TabType, label: "Leaderboard", icon: Trophy },
    { id: "quiz-leaders" as TabType, label: "Quiz Leaders", icon: Trophy },
    { id: "campus" as TabType, label: "Campus", icon: School },
    { id: "offline" as TabType, label: "Offline", icon: WifiOff },
    { id: "referral" as TabType, label: "Refer", icon: Gift },
    { id: "subscription" as TabType, label: "Upgrade", icon: Crown },
    { id: "settings" as TabType, label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Onboarding Guide */}
      <OnboardingGuide 
        onComplete={handleOnboardingComplete} 
        onNavigate={handleOnboardingNavigate}
      />
      
      {/* Header with consistent single logo format */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo - Text only */}
            <Link to="/" className="flex items-center">
              <span className="font-display text-xl font-bold text-foreground tracking-tight">
                TalkPDF AI
              </span>
            </Link>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
              Welcome back, {user?.user_metadata?.full_name || "Learner"}!
            </h1>
            <p className="text-muted-foreground">
              Upload a PDF to start learning in your preferred language.
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              {/* Tab Navigation */}
              <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-secondary/50 rounded-xl border border-border/50">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-card">
                {activeTab === "upload" && <PDFUpload onDocumentProcessed={handleDocumentProcessed} onUpgrade={() => setActiveTab("subscription")} />}
                {activeTab === "documents" && <MyDocuments onSelectDocument={handleSelectDocument} />}
                {activeTab === "listen" && (
                  <AudioPlayer 
                    selectedDocumentId={selectedDocumentId} 
                    onExplainBackTrigger={handleExplainBackTrigger}
                  />
                )}
                {activeTab === "explain" && (
                  <FeatureGate 
                    feature="explainBack" 
                    onUpgrade={() => setActiveTab("subscription")}
                    featureName="Explain-Back Mode"
                  >
                    <ExplainBackMode 
                      documentId={selectedDocumentId || undefined} 
                      promptIndex={selectedPromptIndex}
                      onBadgeEarned={handleBadgeEarned}
                    />
                  </FeatureGate>
                )}
                {activeTab === "quiz" && (
                  <QuizMode 
                    documentId={selectedDocumentId || undefined}
                    onComplete={(score, total) => {
                      if (score >= total * 0.8) handleBadgeEarned();
                    }}
                  />
                )}
                {activeTab === "lessons" && (
                  <FeatureGate 
                    feature="microLessons" 
                    onUpgrade={() => setActiveTab("subscription")}
                    featureName="Micro-Lessons"
                  >
                    <MicroLessons onLessonComplete={() => handleBadgeEarned()} />
                  </FeatureGate>
                )}
                {activeTab === "progress" && (
                  <ProgressDashboard onNavigate={(tab) => setActiveTab(tab as TabType)} />
                )}
                {activeTab === "review" && (
                  <SpacedRepetition onStartReview={(docId, idx) => {
                    setSelectedDocumentId(docId);
                    setSelectedPromptIndex(idx);
                    setActiveTab("explain");
                  }} />
                )}
                {activeTab === "badges" && <BadgesDisplay key={badgeRefreshKey} />}
                {activeTab === "groups" && <StudyGroups />}
                {activeTab === "leaderboard" && <Leaderboard />}
                {activeTab === "quiz-leaders" && <QuizLeaderboard />}
                {activeTab === "campus" && (
                  <FeatureGate 
                    feature="campusLeaderboard" 
                    onUpgrade={() => setActiveTab("subscription")}
                    featureName="Campus Leaderboard"
                  >
                    <CampusTab />
                  </FeatureGate>
                )}
                {activeTab === "offline" && (
                  <FeatureGate 
                    feature="offlineMode" 
                    onUpgrade={() => setActiveTab("subscription")}
                    featureName="Offline Mode"
                  >
                    <OfflineAudioManager />
                  </FeatureGate>
                )}
                {activeTab === "referral" && <ReferralProgram />}
                {activeTab === "subscription" && <SubscriptionPlans />}
                {activeTab === "settings" && <ProfileSettings user={user} />}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <UsageLimitsDisplay onUpgrade={() => setActiveTab("subscription")} />
              <CreditsUsageTracker onUpgrade={() => setActiveTab("subscription")} />
              <ReferralLeaderboard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
