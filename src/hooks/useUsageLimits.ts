import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UsageLimits {
  pdfs_per_day: number;        // For free plan (daily)
  pdfs_per_month: number;      // For paid plans (monthly)
  audio_minutes_per_day: number;
  explain_back_per_day: number;
  ai_questions_per_day: number; // AI questions in Read & Learn
  can_download: boolean;
}

export interface DailyUsage {
  pdfs_uploaded: number;       // Daily count (for free)
  pdfs_uploaded_month: number; // Monthly count (for paid)
  audio_minutes_used: number;
  explain_back_count: number;
  ai_questions_asked: number;  // Daily AI questions count
}

export const PLAN_LIMITS: Record<string, UsageLimits> = {
  free: {
    pdfs_per_day: 2,
    pdfs_per_month: -1,  // Not applicable for free
    audio_minutes_per_day: 5,
    explain_back_per_day: 0,
    ai_questions_per_day: 5, // 5 questions per day for free
    can_download: false,
  },
  plus: {
    pdfs_per_day: 20,    // Changed from monthly to daily
    pdfs_per_month: -1,  // Not applicable anymore
    audio_minutes_per_day: 60,
    explain_back_per_day: 20,
    ai_questions_per_day: 30, // 30 questions per day for Plus
    can_download: false,
  },
  pro: {
    pdfs_per_day: -1,    // Pro is unlimited
    pdfs_per_month: -1,  // Unlimited
    audio_minutes_per_day: -1,
    explain_back_per_day: -1,
    ai_questions_per_day: -1, // Unlimited for Pro
    can_download: true,
  },
};

export function useUsageLimits() {
  const [plan, setPlan] = useState<string>("free");
  const [usage, setUsage] = useState<DailyUsage>({
    pdfs_uploaded: 0,
    pdfs_uploaded_month: 0,
    audio_minutes_used: 0,
    explain_back_count: 0,
    ai_questions_asked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [subscriptionStartedAt, setSubscriptionStartedAt] = useState<string | null>(null);

  const fetchUsageData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Get user's plan and subscription start date
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, subscription_started_at")
        .eq("user_id", session.user.id)
        .single();

      const currentPlan = profile?.subscription_plan || "free";
      setPlan(currentPlan);
      setSubscriptionStartedAt(profile?.subscription_started_at || null);

      // Get today's usage (for daily limits - free plan and audio)
      const today = new Date().toISOString().split("T")[0];
      const { data: dailyUsage } = await supabase
        .from("daily_usage_summary")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("date", today)
        .single();

      const pdfsToday = dailyUsage?.pdfs_uploaded || 0;
      const audioMinutesToday = Number(dailyUsage?.audio_minutes_used) || 0;
      const explainBackToday = dailyUsage?.explain_back_count || 0;
      const aiQuestionsToday = (dailyUsage as { ai_questions_asked?: number })?.ai_questions_asked || 0;

      // For paid plans, calculate monthly PDF uploads from usage_tracking
      let pdfsThisMonth = 0;
      if (currentPlan !== "free") {
        // Determine billing period start
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        let periodStart = startOfMonth;
        if (profile?.subscription_started_at) {
          const subStart = new Date(profile.subscription_started_at);
          // If subscription started this month, use that date
          if (subStart > startOfMonth) {
            periodStart = subStart;
          }
        }

        // Count PDF uploads since period start
        const { count } = await supabase
          .from("usage_tracking")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("action_type", "pdf_upload")
          .gte("created_at", periodStart.toISOString());

        pdfsThisMonth = count || 0;
      }

      setUsage({
        pdfs_uploaded: pdfsToday,
        pdfs_uploaded_month: pdfsThisMonth,
        audio_minutes_used: audioMinutesToday,
        explain_back_count: explainBackToday,
        ai_questions_asked: aiQuestionsToday,
      });
    } catch (error) {
      console.error("Error fetching usage:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsageData();
    
    // Real-time subscription for cross-device sync
    const setupRealtimeSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const channel = supabase
        .channel(`usage-sync-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "daily_usage_summary",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            console.log("Usage data changed, refreshing...");
            fetchUsageData();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "usage_tracking",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            console.log("New usage tracked, refreshing...");
            fetchUsageData();
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

    // Visibility change listener for tab switching
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUsageData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cleanup?.();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchUsageData]);

  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  const canUploadPdf = useCallback(() => {
    // Pro plan has unlimited uploads
    if (plan === "pro") return true;
    
    // Both Free and Plus now use daily limits
    if (limits.pdfs_per_day === -1) return true;
    return usage.pdfs_uploaded < limits.pdfs_per_day;
  }, [plan, usage.pdfs_uploaded, limits.pdfs_per_day]);

  const canUseAudio = useCallback(() => {
    if (limits.audio_minutes_per_day === -1) return true;
    return usage.audio_minutes_used < limits.audio_minutes_per_day;
  }, [usage.audio_minutes_used, limits.audio_minutes_per_day]);

  const canUseExplainBack = useCallback(() => {
    if (limits.explain_back_per_day === -1) return true;
    if (limits.explain_back_per_day === 0) return false;
    return usage.explain_back_count < limits.explain_back_per_day;
  }, [usage.explain_back_count, limits.explain_back_per_day]);

  const getRemainingPdfs = useCallback(() => {
    // Pro plan has unlimited
    if (plan === "pro") return Infinity;
    
    // Both Free and Plus now use daily limits
    if (limits.pdfs_per_day === -1) return Infinity;
    return Math.max(0, limits.pdfs_per_day - usage.pdfs_uploaded);
  }, [plan, usage.pdfs_uploaded, limits.pdfs_per_day]);

  const getRemainingAudioMinutes = useCallback(() => {
    if (limits.audio_minutes_per_day === -1) return Infinity;
    return Math.max(0, limits.audio_minutes_per_day - usage.audio_minutes_used);
  }, [usage.audio_minutes_used, limits.audio_minutes_per_day]);

  // Helper to get the appropriate PDF limit display
  const getPdfLimitDisplay = useCallback(() => {
    if (plan === "pro") return { used: 0, limit: -1, period: "day" };
    // Both Free and Plus now use daily limits
    return { used: usage.pdfs_uploaded, limit: limits.pdfs_per_day, period: "day" };
  }, [plan, usage.pdfs_uploaded, limits.pdfs_per_day]);

  // AI Question limits for Read & Learn feature
  const canAskAIQuestion = useCallback(() => {
    if (limits.ai_questions_per_day === -1) return true;
    return usage.ai_questions_asked < limits.ai_questions_per_day;
  }, [usage.ai_questions_asked, limits.ai_questions_per_day]);

  const getRemainingAIQuestions = useCallback(() => {
    if (limits.ai_questions_per_day === -1) return Infinity;
    return Math.max(0, limits.ai_questions_per_day - usage.ai_questions_asked);
  }, [usage.ai_questions_asked, limits.ai_questions_per_day]);

  return {
    plan,
    usage,
    limits,
    loading,
    subscriptionStartedAt,
    refetch: fetchUsageData,
    canUploadPdf,
    canUseAudio,
    canUseExplainBack,
    getRemainingPdfs,
    getRemainingAudioMinutes,
    getPdfLimitDisplay,
    canAskAIQuestion,
    getRemainingAIQuestions,
  };
}
