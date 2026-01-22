import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionPlan = "free" | "plus" | "pro";

export interface PlanFeatures {
  audioMinutesPerDay: number;
  pdfUploadsPerDay: number;
  languages: string[];
  explainBack: boolean;
  microLessons: boolean;
  advancedMicroLessons: boolean;
  quizAccess: boolean;
  quizLeaderboard: boolean;
  campusLeaderboard: boolean;
  allBadges: boolean;
  silverBadges: boolean;
  whatsappIntegration: boolean;
  offlineMode: boolean;
  downloadAudio: boolean;
  prioritySupport: boolean;
  credits: number; // Monthly credits
}

export const PLAN_FEATURES: Record<SubscriptionPlan, PlanFeatures> = {
  free: {
    audioMinutesPerDay: 5,
    pdfUploadsPerDay: 2,
    languages: ["english"],
    explainBack: false,
    microLessons: false,
    advancedMicroLessons: false,
    quizAccess: true,
    quizLeaderboard: true,
    campusLeaderboard: false,
    allBadges: false,
    silverBadges: false,
    whatsappIntegration: false,
    offlineMode: false,
    downloadAudio: false,
    prioritySupport: false,
    credits: 0,
  },
  plus: {
    audioMinutesPerDay: 60,
    pdfUploadsPerDay: 20,
    languages: ["english", "yoruba", "igbo"],
    explainBack: true,
    microLessons: true,
    advancedMicroLessons: false,
    quizAccess: true,
    quizLeaderboard: true,
    campusLeaderboard: false,
    allBadges: false,
    silverBadges: true,
    whatsappIntegration: false,
    offlineMode: false,
    downloadAudio: false,
    prioritySupport: false,
    credits: 100,
  },
  pro: {
    audioMinutesPerDay: -1, // Unlimited
    pdfUploadsPerDay: -1, // Unlimited
    languages: ["english", "yoruba", "igbo", "hausa", "pidgin"],
    explainBack: true,
    microLessons: true,
    advancedMicroLessons: true,
    quizAccess: true,
    quizLeaderboard: true,
    campusLeaderboard: true,
    allBadges: true,
    silverBadges: true,
    whatsappIntegration: true,
    offlineMode: true,
    downloadAudio: true,
    prioritySupport: true,
    credits: 500,
  },
};

export function useFeatureAccess() {
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [loading, setLoading] = useState(true);
  const [referralCredits, setReferralCredits] = useState(0);

  const fetchPlan = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, referral_credits")
        .eq("user_id", user.id)
        .single();

      if (profile?.subscription_plan) {
        setPlan(profile.subscription_plan as SubscriptionPlan);
      }
      setReferralCredits(profile?.referral_credits || 0);
    } catch (error) {
      console.error("Error fetching plan:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.free;

  const canAccess = useCallback(
    (feature: keyof PlanFeatures): boolean => {
      const value = features[feature];
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    },
    [features]
  );

  const hasFeature = useCallback(
    (feature: keyof PlanFeatures): boolean => canAccess(feature),
    [canAccess]
  );

  const getUpgradeMessage = useCallback(
    (feature: string): string => {
      if (plan === "free") {
        return `Upgrade to Plus or Pro to access ${feature}`;
      }
      if (plan === "plus") {
        return `Upgrade to Pro to access ${feature}`;
      }
      return "";
    },
    [plan]
  );

  return {
    plan,
    features,
    loading,
    referralCredits,
    canAccess,
    hasFeature,
    getUpgradeMessage,
    refetch: fetchPlan,
    isPro: plan === "pro",
    isPlus: plan === "plus",
    isFree: plan === "free",
  };
}
