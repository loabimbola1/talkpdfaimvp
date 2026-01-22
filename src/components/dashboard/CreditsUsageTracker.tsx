import { useState, useEffect } from "react";
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
}

const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  plus: 100,
  pro: 500,
};

const CreditsUsageTracker = ({ onUpgrade }: CreditsUsageTrackerProps) => {
  const [creditsData, setCreditsData] = useState<CreditsData>({
    plan: "free",
    totalCredits: 0,
    usedCredits: 0,
    referralCredits: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditsData();
  }, []);

  const fetchCreditsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's profile for plan and referral credits
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, referral_credits")
        .eq("user_id", user.id)
        .single();

      const plan = profile?.subscription_plan || "free";
      const referralCredits = profile?.referral_credits || 0;
      const planCredits = PLAN_CREDITS[plan] || 0;

      // Calculate used credits from this month's usage
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data: usageData } = await supabase
        .from("usage_tracking")
        .select("action_type, audio_minutes_used")
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth);

      // Each PDF upload = 1 credit, each 5 min audio = 1 credit, each explain-back = 2 credits
      let usedCredits = 0;
      (usageData || []).forEach(entry => {
        if (entry.action_type === "pdf_upload") usedCredits += 1;
        if (entry.action_type === "audio_conversion") usedCredits += Math.ceil((entry.audio_minutes_used || 0) / 5);
        if (entry.action_type === "explain_back") usedCredits += 2;
      });

      setCreditsData({
        plan,
        totalCredits: planCredits + referralCredits,
        usedCredits: Math.min(usedCredits, planCredits + referralCredits),
        referralCredits,
      });
    } catch (error) {
      console.error("Error fetching credits:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  const remainingCredits = Math.max(0, creditsData.totalCredits - creditsData.usedCredits);
  const usagePercentage = creditsData.totalCredits > 0 
    ? Math.min((creditsData.usedCredits / creditsData.totalCredits) * 100, 100)
    : 0;

  const isLow = usagePercentage > 80;
  const isDepleted = remainingCredits === 0 && creditsData.totalCredits > 0;

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
            Resets monthly
          </div>
        </div>
        <CardDescription>
          Track your credit usage for the current billing period
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
            <span className="text-sm text-destructive">Credits depleted for this month</span>
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
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 bg-secondary/50 rounded">
              <p className="font-medium">1 credit</p>
              <p className="text-muted-foreground">per PDF</p>
            </div>
            <div className="text-center p-2 bg-secondary/50 rounded">
              <p className="font-medium">1 credit</p>
              <p className="text-muted-foreground">per 5 min audio</p>
            </div>
            <div className="text-center p-2 bg-secondary/50 rounded">
              <p className="font-medium">2 credits</p>
              <p className="text-muted-foreground">per explain-back</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditsUsageTracker;
