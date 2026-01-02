import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FileText, Headphones, Brain, AlertTriangle, Crown } from "lucide-react";
import { Link } from "react-router-dom";

interface UsageLimits {
  pdfs_per_day: number;
  audio_minutes_per_day: number;
  explain_back_per_day: number;
  can_download: boolean;
}

const PLAN_LIMITS: Record<string, UsageLimits> = {
  free: {
    pdfs_per_day: 2,
    audio_minutes_per_day: 5,
    explain_back_per_day: 0,
    can_download: false,
  },
  student_pro: {
    pdfs_per_day: 10,
    audio_minutes_per_day: 60,
    explain_back_per_day: 20,
    can_download: false,
  },
  mastery_pass: {
    pdfs_per_day: -1, // unlimited
    audio_minutes_per_day: -1,
    explain_back_per_day: -1,
    can_download: true,
  },
};

interface DailyUsage {
  pdfs_uploaded: number;
  audio_minutes_used: number;
  explain_back_count: number;
}

const UsageLimitsDisplay = () => {
  const [plan, setPlan] = useState<string>("free");
  const [usage, setUsage] = useState<DailyUsage>({
    pdfs_uploaded: 0,
    audio_minutes_used: 0,
    explain_back_count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Get user's plan
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("user_id", session.user.id)
        .single();

      if (profile?.subscription_plan) {
        setPlan(profile.subscription_plan);
      }

      // Get today's usage
      const today = new Date().toISOString().split("T")[0];
      const { data: dailyUsage } = await supabase
        .from("daily_usage_summary")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("date", today)
        .single();

      if (dailyUsage) {
        setUsage({
          pdfs_uploaded: dailyUsage.pdfs_uploaded || 0,
          audio_minutes_used: Number(dailyUsage.audio_minutes_used) || 0,
          explain_back_count: dailyUsage.explain_back_count || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching usage:", error);
    } finally {
      setLoading(false);
    }
  };

  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const isLimitReached = (used: number, limit: number) => {
    if (limit === -1) return false;
    return used >= limit;
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? "Unlimited" : limit.toString();
  };

  if (loading) {
    return null;
  }

  const showWarning = 
    isLimitReached(usage.pdfs_uploaded, limits.pdfs_per_day) ||
    isLimitReached(usage.audio_minutes_used, limits.audio_minutes_per_day);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Daily Usage</CardTitle>
            <CardDescription>Your usage resets at midnight</CardDescription>
          </div>
          {plan !== "mastery_pass" && (
            <Link to="/#pricing">
              <Button variant="outline" size="sm" className="gap-2">
                <Crown className="h-4 w-4" />
                Upgrade
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showWarning && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>You've reached some daily limits. Upgrade to continue.</span>
          </div>
        )}

        {/* PDFs Uploaded */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>PDFs Uploaded</span>
            </div>
            <span className="text-muted-foreground">
              {usage.pdfs_uploaded} / {formatLimit(limits.pdfs_per_day)}
            </span>
          </div>
          {limits.pdfs_per_day !== -1 && (
            <Progress 
              value={getUsagePercentage(usage.pdfs_uploaded, limits.pdfs_per_day)} 
              className={isLimitReached(usage.pdfs_uploaded, limits.pdfs_per_day) ? "[&>div]:bg-destructive" : ""}
            />
          )}
        </div>

        {/* Audio Minutes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-muted-foreground" />
              <span>Audio Minutes</span>
            </div>
            <span className="text-muted-foreground">
              {Math.round(usage.audio_minutes_used)} / {formatLimit(limits.audio_minutes_per_day)} min
            </span>
          </div>
          {limits.audio_minutes_per_day !== -1 && (
            <Progress 
              value={getUsagePercentage(usage.audio_minutes_used, limits.audio_minutes_per_day)} 
              className={isLimitReached(usage.audio_minutes_used, limits.audio_minutes_per_day) ? "[&>div]:bg-destructive" : ""}
            />
          )}
        </div>

        {/* Explain-Back (only show if available) */}
        {limits.explain_back_per_day !== 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <span>Explain-Back Sessions</span>
              </div>
              <span className="text-muted-foreground">
                {usage.explain_back_count} / {formatLimit(limits.explain_back_per_day)}
              </span>
            </div>
            {limits.explain_back_per_day !== -1 && (
              <Progress 
                value={getUsagePercentage(usage.explain_back_count, limits.explain_back_per_day)} 
              />
            )}
          </div>
        )}

        {limits.explain_back_per_day === 0 && (
          <div className="text-sm text-muted-foreground text-center py-2">
            Explain-Back Mode is available on Student Pro and above
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UsageLimitsDisplay;
