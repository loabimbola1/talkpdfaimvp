import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UsageLimits {
  pdfs_per_day: number;
  audio_minutes_per_day: number;
  explain_back_per_day: number;
  can_download: boolean;
}

export interface DailyUsage {
  pdfs_uploaded: number;
  audio_minutes_used: number;
  explain_back_count: number;
}

export const PLAN_LIMITS: Record<string, UsageLimits> = {
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

export function useUsageLimits() {
  const [plan, setPlan] = useState<string>("free");
  const [usage, setUsage] = useState<DailyUsage>({
    pdfs_uploaded: 0,
    audio_minutes_used: 0,
    explain_back_count: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchUsageData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  const canUploadPdf = useCallback(() => {
    if (limits.pdfs_per_day === -1) return true;
    return usage.pdfs_uploaded < limits.pdfs_per_day;
  }, [usage.pdfs_uploaded, limits.pdfs_per_day]);

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
    if (limits.pdfs_per_day === -1) return Infinity;
    return Math.max(0, limits.pdfs_per_day - usage.pdfs_uploaded);
  }, [usage.pdfs_uploaded, limits.pdfs_per_day]);

  const getRemainingAudioMinutes = useCallback(() => {
    if (limits.audio_minutes_per_day === -1) return Infinity;
    return Math.max(0, limits.audio_minutes_per_day - usage.audio_minutes_used);
  }, [usage.audio_minutes_used, limits.audio_minutes_per_day]);

  return {
    plan,
    usage,
    limits,
    loading,
    refetch: fetchUsageData,
    canUploadPdf,
    canUseAudio,
    canUseExplainBack,
    getRemainingPdfs,
    getRemainingAudioMinutes,
  };
}
