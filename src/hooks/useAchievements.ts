import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  target: number;
}

interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  target: number;
  category: "documents" | "quiz" | "lessons" | "badges" | "streak";
}

const ACHIEVEMENT_CONFIGS: AchievementConfig[] = [
  { id: "first_pdf", name: "First Steps", description: "Upload your first PDF", icon: "📄", target: 1, category: "documents" },
  { id: "pdf_5", name: "Getting Serious", description: "Upload 5 PDFs", icon: "📚", target: 5, category: "documents" },
  { id: "pdf_10", name: "Bookworm", description: "Upload 10 PDFs", icon: "🐛", target: 10, category: "documents" },
  { id: "pdf_25", name: "Scholar", description: "Upload 25 PDFs", icon: "🎓", target: 25, category: "documents" },
  { id: "pdf_50", name: "Knowledge Seeker", description: "Upload 50 PDFs", icon: "🔬", target: 50, category: "documents" },
  { id: "first_quiz", name: "Quiz Starter", description: "Complete your first quiz", icon: "❓", target: 1, category: "quiz" },
  { id: "quiz_10", name: "Quiz Master", description: "Complete 10 quizzes", icon: "🎯", target: 10, category: "quiz" },
  { id: "quiz_perfect", name: "Perfect Score", description: "Get 100% on any quiz", icon: "💯", target: 1, category: "quiz" },
  { id: "quiz_50", name: "Quiz Champion", description: "Complete 50 quizzes", icon: "🏆", target: 50, category: "quiz" },
  { id: "first_lesson", name: "Micro Learner", description: "Complete your first micro-lesson", icon: "📖", target: 1, category: "lessons" },
  { id: "lesson_10", name: "Lesson Pro", description: "Complete 10 micro-lessons", icon: "✨", target: 10, category: "lessons" },
  { id: "lesson_50", name: "Lesson Legend", description: "Complete 50 micro-lessons", icon: "🌟", target: 50, category: "lessons" },
  { id: "first_badge", name: "Badge Collector", description: "Earn your first badge", icon: "🏅", target: 1, category: "badges" },
  { id: "badge_gold", name: "Gold Rush", description: "Earn a gold badge", icon: "🥇", target: 1, category: "badges" },
  { id: "badge_10", name: "Badge Hunter", description: "Earn 10 badges", icon: "🎖️", target: 10, category: "badges" },
  { id: "streak_3", name: "On Fire", description: "Study 3 days in a row", icon: "🔥", target: 3, category: "streak" },
  { id: "streak_7", name: "Week Warrior", description: "Study 7 days in a row", icon: "⚡", target: 7, category: "streak" },
  { id: "streak_30", name: "Monthly Master", description: "Study 30 days in a row", icon: "🌙", target: 30, category: "streak" },
];

// Simple confetti trigger without external library
const triggerConfetti = () => {
  // Create canvas element for confetti
  const duration = 3000;
  const end = Date.now() + duration;

  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
};

export function useAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement | null>(null);

  const calculateProgress = useCallback(async (userId: string) => {
    const progress: Record<string, number> = {};
    const perfectQuiz: boolean[] = [];

    // Get document count
    const { count: docCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    progress.documents = docCount || 0;

    // Get quiz count and check for perfect scores
    const { data: quizzes, count: quizCount } = await supabase
      .from("quiz_scores")
      .select("score, total_questions", { count: "exact" })
      .eq("user_id", userId);
    progress.quiz = quizCount || 0;
    if (quizzes) {
      quizzes.forEach((q) => {
        if (q.score === q.total_questions) perfectQuiz.push(true);
      });
    }
    progress.quiz_perfect = perfectQuiz.length;

    // Get lesson count
    const { count: lessonCount } = await supabase
      .from("micro_lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    progress.lessons = lessonCount || 0;

    // Get badge count and gold badges
    const { data: badges, count: badgeCount } = await supabase
      .from("badges")
      .select("badge_type", { count: "exact" })
      .eq("user_id", userId);
    progress.badges = badgeCount || 0;
    progress.badge_gold = badges?.filter((b) => b.badge_type === "gold").length || 0;

    // Calculate streak from daily usage
    const { data: dailyUsage } = await supabase
      .from("daily_usage_summary")
      .select("date")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(60);

    let streak = 0;
    if (dailyUsage && dailyUsage.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < dailyUsage.length; i++) {
        const usageDate = new Date(dailyUsage[i].date);
        usageDate.setHours(0, 0, 0, 0);
        
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        
        if (usageDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      }
    }
    progress.streak = streak;

    return progress;
  }, []);

  const fetchAchievements = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const progress = await calculateProgress(user.id);

      // Map progress to achievements
      const mapped: Achievement[] = ACHIEVEMENT_CONFIGS.map((config) => {
        let currentProgress = 0;

        switch (config.id) {
          case "first_pdf":
          case "pdf_5":
          case "pdf_10":
          case "pdf_25":
          case "pdf_50":
            currentProgress = progress.documents || 0;
            break;
          case "first_quiz":
          case "quiz_10":
          case "quiz_50":
            currentProgress = progress.quiz || 0;
            break;
          case "quiz_perfect":
            currentProgress = progress.quiz_perfect || 0;
            break;
          case "first_lesson":
          case "lesson_10":
          case "lesson_50":
            currentProgress = progress.lessons || 0;
            break;
          case "first_badge":
          case "badge_10":
            currentProgress = progress.badges || 0;
            break;
          case "badge_gold":
            currentProgress = progress.badge_gold || 0;
            break;
          case "streak_3":
          case "streak_7":
          case "streak_30":
            currentProgress = progress.streak || 0;
            break;
        }

        return {
          id: config.id,
          name: config.name,
          description: config.description,
          icon: config.icon,
          unlocked: currentProgress >= config.target,
          progress: Math.min(currentProgress, config.target),
          target: config.target,
        };
      });

      setAchievements(mapped);
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setLoading(false);
    }
  }, [calculateProgress]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const checkAndCelebrate = useCallback(
    async (achievementId: string) => {
      const achievement = achievements.find((a) => a.id === achievementId);
      if (!achievement) return;

      // Refetch to get latest progress
      await fetchAchievements();

      const updatedAchievement = achievements.find((a) => a.id === achievementId);
      if (updatedAchievement?.unlocked && !achievement.unlocked) {
        setNewlyUnlocked(updatedAchievement);
        triggerConfetti();
        toast.success(`🎉 Achievement Unlocked: ${updatedAchievement.name}!`, {
          description: updatedAchievement.description,
          duration: 5000,
        });
      }
    },
    [achievements, fetchAchievements]
  );

  const dismissNewlyUnlocked = useCallback(() => {
    setNewlyUnlocked(null);
  }, []);

  return {
    achievements,
    loading,
    newlyUnlocked,
    dismissNewlyUnlocked,
    refetch: fetchAchievements,
    checkAndCelebrate,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    totalCount: achievements.length,
  };
}
