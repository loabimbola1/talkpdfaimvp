import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Upload, Headphones, Award, Settings, User, FileText, Brain, Crown, Trophy } from "lucide-react";
import logo from "@/assets/logo.png";
import PDFUpload from "@/components/dashboard/PDFUpload";
import AudioPlayer from "@/components/dashboard/AudioPlayer";
import MyDocuments from "@/components/dashboard/MyDocuments";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
import ExplainBackMode from "@/components/dashboard/ExplainBackMode";
import UsageLimitsDisplay from "@/components/dashboard/UsageLimitsDisplay";
import SubscriptionPlans from "@/components/dashboard/SubscriptionPlans";
import BadgesDisplay from "@/components/dashboard/BadgesDisplay";
import Leaderboard from "@/components/dashboard/Leaderboard";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type TabType = "upload" | "documents" | "listen" | "explain" | "badges" | "leaderboard" | "subscription" | "settings";

const Dashboard = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("upload");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedPromptIndex, setSelectedPromptIndex] = useState<number>(0);
  const [badgeRefreshKey, setBadgeRefreshKey] = useState(0);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle deep linking from URL params
  useEffect(() => {
    const tab = searchParams.get("tab");
    const docId = searchParams.get("doc");
    const promptIndex = searchParams.get("prompt");
    
    if (tab && ["upload", "documents", "listen", "explain", "badges", "leaderboard", "subscription", "settings"].includes(tab)) {
      setActiveTab(tab as TabType);
    }
    if (docId) {
      setSelectedDocumentId(docId);
    }
    if (promptIndex) {
      setSelectedPromptIndex(parseInt(promptIndex, 10));
    }
  }, [searchParams]);

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
    { id: "badges" as TabType, label: "Badges", icon: Award },
    { id: "leaderboard" as TabType, label: "Leaderboard", icon: Trophy },
    { id: "subscription" as TabType, label: "Upgrade", icon: Crown },
    { id: "settings" as TabType, label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-2">
              <img src={logo} alt="TalkPDF AI" className="h-8 w-auto" />
              <span className="font-display text-lg font-bold text-foreground">TalkPDF AI</span>
            </a>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
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
              <div className="flex flex-wrap gap-2 mb-6 p-1 bg-secondary/50 rounded-xl">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
                {activeTab === "upload" && <PDFUpload onDocumentProcessed={handleDocumentProcessed} />}
                {activeTab === "documents" && <MyDocuments onSelectDocument={handleSelectDocument} />}
                {activeTab === "listen" && (
                  <AudioPlayer 
                    selectedDocumentId={selectedDocumentId} 
                    onExplainBackTrigger={handleExplainBackTrigger}
                  />
                )}
                {activeTab === "explain" && (
                  <ExplainBackMode 
                    documentId={selectedDocumentId || undefined} 
                    promptIndex={selectedPromptIndex}
                    onBadgeEarned={handleBadgeEarned}
                  />
                )}
                {activeTab === "badges" && <BadgesDisplay key={badgeRefreshKey} />}
                {activeTab === "leaderboard" && <Leaderboard />}
                {activeTab === "subscription" && <SubscriptionPlans />}
                {activeTab === "settings" && <ProfileSettings user={user} />}
              </div>
            </div>

            <div className="lg:col-span-1">
              <UsageLimitsDisplay onUpgrade={() => setActiveTab("subscription")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
