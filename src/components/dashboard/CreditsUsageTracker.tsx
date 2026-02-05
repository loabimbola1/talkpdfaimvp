import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Coins, Crown, TrendingUp, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditsUsageTrackerProps {
  onUpgrade?: () => void;
}

interface CreditsData {
  plan: string;
  totalCredits: number;
  usedCredits: number;
  referralCredits: number;
  subscriptionStartedAt: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
}

const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  plus: 150,  // Updated from 100 to 150 (+50% to offset increased costs)
  pro: 500,
};

// Credit costs per action - Updated for profitability
const CREDIT_COSTS = {
  pdf_upload: 2,        // Updated from 1 (Gemini extraction + summary)
  audio_per_5_min: 2,   // Updated from 1 (TTS is expensive)
  explain_back: 3,      // Updated from 2 (uses Gemini Pro)
  quiz: 2,              // Updated from 1 (uses Gemini Pro)
  micro_lesson: 1,      // Keep affordable for engagement
  ai_question: 1,       // NEW: AI questions in Read & Learn
};

const CreditsUsageTracker = ({ onUpgrade }: CreditsUsageTrackerProps) => {
  const [creditsData, setCreditsData] = useState<CreditsData>({
    plan: "free",
    totalCredits: 0,
    usedCredits: 0,
    referralCredits: 0,
    subscriptionStartedAt: null,
    billingPeriodStart: null,
    billingPeriodEnd: null,
  });
  const [loading, setLoading] = useState(true);
  const lastFetchTime = useRef<number>(0);
  const CACHE_DURATION = 3000; // 3 seconds minimum between fetches

  const fetchCreditsData = useCallback(async (forceRefresh = false) => {
    // Prevent rapid re-fetches unless forced
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < CACHE_DURATION) {
      return;
    }
    lastFetchTime.current = now;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's profile for plan, referral credits, and subscription_started_at
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("subscription_plan, referral_credits, subscription_started_at")
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return;
      }

      const plan = profile?.subscription_plan || "free";
      const referralCredits = profile?.referral_credits || 0;
      const planCredits = PLAN_CREDITS[plan] || 0;
      const subscriptionStartedAt = profile?.subscription_started_at;

      // Calculate billing period based on subscription start date
      const currentDate = new Date();
      let periodStart: Date;
      let periodEnd: Date;
      
      if (subscriptionStartedAt && plan !== "free") {
        const subStart = new Date(subscriptionStartedAt);
        const subscriptionDay = subStart.getDate();
        
        periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), subscriptionDay);
        
        if (periodStart > currentDate) {
          periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, subscriptionDay);
        }
        
        periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, subscriptionDay);
      } else {
        periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      }

      const startDate = periodStart.toISOString();
      const endDate = periodEnd.toISOString();
      
      // Query usage within the billing period only
      const { data: usageData, error: usageError } = await supabase
        .from("usage_tracking")
        .select("action_type, audio_minutes_used")
        .eq("user_id", user.id)
        .gte("created_at", startDate)
        .lt("created_at", endDate);

      if (usageError) {
        console.error("Error fetching usage:", usageError);
      }

      // Calculate credits used with proper cost structure
      let usedCredits = 0;
      (usageData || []).forEach(entry => {
        if (entry.action_type === "pdf_upload") {
          usedCredits += CREDIT_COSTS.pdf_upload;
        }
        if (entry.action_type === "audio_conversion") {
          usedCredits += Math.ceil((entry.audio_minutes_used || 0) / 5) * CREDIT_COSTS.audio_per_5_min;
        }
        if (entry.action_type === "explain_back") {
          usedCredits += CREDIT_COSTS.explain_back;
        }
        if (entry.action_type === "quiz") {
          usedCredits += CREDIT_COSTS.quiz;
        }
        if (entry.action_type === "micro_lesson") {
          usedCredits += CREDIT_COSTS.micro_lesson;
        }
        if (entry.action_type === "ai_question") {
          usedCredits += CREDIT_COSTS.ai_question;
        }
      });

      // Safeguard: Never show more used credits than available
      const totalAvailable = planCredits + referralCredits;
      const actualUsedCredits = Math.min(usedCredits, totalAvailable);

      setCreditsData({
        plan,
        totalCredits: totalAvailable,
        usedCredits: actualUsedCredits,
        referralCredits,
        subscriptionStartedAt,
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
      });
    } catch (error) {
      console.error("Error fetching credits:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch - force refresh
    fetchCreditsData(true);

    // Real-time subscription for cross-device sync
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`credits-sync-${user.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            console.log("Profile changed, refreshing credits...");
            fetchCreditsData(true);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "usage_tracking",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            console.log("New usage tracked, refreshing credits...");
            fetchCreditsData(true);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;
    setupRealtimeSubscription().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    // Visibility change listener for tab/app switching - force refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCreditsData(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Focus event for additional sync (especially for PWA)
    const handleFocus = () => {
      fetchCreditsData(true);
    };
    window.addEventListener("focus", handleFocus);

    // Online event for network reconnection
    const handleOnline = () => {
      fetchCreditsData(true);
    };
    window.addEventListener("online", handleOnline);

    return () => {
      cleanup?.();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [fetchCreditsData]);

  if (loading) {
    return null;
  }

  const remainingCredits = Math.max(0, creditsData.totalCredits - creditsData.usedCredits);
  const usagePercentage = creditsData.totalCredits > 0 
    ? Math.min((creditsData.usedCredits / creditsData.totalCredits) * 100, 100)
    : 0;

  const isLow = usagePercentage > 80;
  const isDepleted = remainingCredits === 0 && creditsData.totalCredits > 0;

  // Format billing period dates for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-NG", { 
      month: "short", 
      day: "numeric" 
    });
  };

  // Free plan shows upgrade prompt instead of credits
  if (creditsData.plan === "free") {
    return (
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Credits</CardTitle>
          </div>
          <CardDescription>
            Upgrade to get monthly credits for premium features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Free plan includes basic features. Upgrade to Plus or Pro for monthly credits.
            </p>
            {creditsData.referralCredits > 0 && (
              <div className="flex items-center justify-center gap-2 mb-4 p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  {creditsData.referralCredits} bonus credits from referrals
                </span>
              </div>
            )}
            <Button onClick={onUpgrade} className="gap-2">
              <Crown className="h-4 w-4" />
              Upgrade Now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Monthly Credits</CardTitle>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {creditsData.billingPeriodStart && creditsData.billingPeriodEnd && (
              <span>
                {formatDate(creditsData.billingPeriodStart)} - {formatDate(creditsData.billingPeriodEnd)}
              </span>
            )}
          </div>
        </div>
        <CardDescription>
          Credits reset on your billing anniversary
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Credits Display */}
        <div className="flex items-center justify-between">
          <div>
            <span className={cn(
              "text-3xl font-bold",
              isDepleted && "text-destructive",
              isLow && !isDepleted && "text-yellow-600"
            )}>
              {remainingCredits}
            </span>
            <span className="text-muted-foreground text-lg"> / {creditsData.totalCredits}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              {creditsData.plan === "plus" ? "Plus" : "Pro"} Plan
            </p>
            <p className="text-xs text-muted-foreground">
              {PLAN_CREDITS[creditsData.plan]} base credits
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress 
            value={usagePercentage} 
            className={cn(
              isDepleted && "[&>div]:bg-destructive",
              isLow && !isDepleted && "[&>div]:bg-yellow-500"
            )}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{creditsData.usedCredits} used</span>
            <span>{remainingCredits} remaining</span>
          </div>
        </div>

        {/* Referral Credits Bonus */}
        {creditsData.referralCredits > 0 && (
          <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-600">
              +{creditsData.referralCredits} bonus credits from referrals
            </span>
          </div>
        )}

        {/* Warning states */}
        {isDepleted && (
          <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
            <span className="text-sm text-destructive">Credits depleted for this period</span>
            {creditsData.plan !== "pro" && (
              <Button size="sm" variant="outline" onClick={onUpgrade} className="gap-1">
                <Crown className="h-3 w-3" />
                Upgrade
              </Button>
            )}
          </div>
        )}

        {isLow && !isDepleted && (
          <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
            <span className="text-sm text-yellow-600">Credits running low</span>
            {creditsData.plan !== "pro" && (
              <Button size="sm" variant="outline" onClick={onUpgrade} className="gap-1">
                <Crown className="h-3 w-3" />
                Get more
              </Button>
            )}
          </div>
        )}

        {/* Credit Usage Guide */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Credit usage:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="text-center p-2 bg-secondary/50 rounded">
              <p className="font-medium">{CREDIT_COSTS.pdf_upload} credits</p>
              <p className="text-muted-foreground">per PDF</p>
            </div>
            <div className="text-center p-2 bg-secondary/50 rounded">
              <p className="font-medium">{CREDIT_COSTS.audio_per_5_min} credits</p>
              <p className="text-muted-foreground">per 5 min audio</p>
            </div>
            <div className="text-center p-2 bg-secondary/50 rounded">
              <p className="font-medium">{CREDIT_COSTS.explain_back} credits</p>
              <p className="text-muted-foreground">per explain-back</p>
            </div>
            <div className="text-center p-2 bg-secondary/50 rounded">
              <p className="font-medium">{CREDIT_COSTS.ai_question} credit</p>
              <p className="text-muted-foreground">per AI question</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditsUsageTracker;
