import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

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
  { id: "quiz_50", name: "Quiz Champion", description: "Complete 50 quizzes", icon: "🏆", target: 50, category: "quiz" },
  { id: "first_lesson", name: "Micro Learner", description: "Complete your first micro-lesson", icon: "📖", target: 1, category: "lessons" },
  { id: "lesson_10", name: "Lesson Pro", description: "Complete 10 micro-lessons", icon: "✨", target: 10, category: "lessons" },
  { id: "lesson_50", name: "Lesson Legend", description: "Complete 50 micro-lessons", icon: "🌟", target: 50, category: "lessons" },
  { id: "first_badge", name: "Badge Collector", description: "Earn your first badge", icon: "🏅", target: 1, category: "badges" },
  { id: "badge_10", name: "Badge Hunter", description: "Earn 10 badges", icon: "🎖️", target: 10, category: "badges" },
  { id: "streak_3", name: "On Fire", description: "Study 3 days in a row", icon: "🔥", target: 3, category: "streak" },
  { id: "streak_7", name: "Week Warrior", description: "Study 7 days in a row", icon: "⚡", target: 7, category: "streak" },
  { id: "streak_30", name: "Monthly Master", description: "Study 30 days in a row", icon: "🌙", target: 30, category: "streak" },
];

export function useMilestoneNotifications() {
  const { isSubscribed, scheduleStudyReminder } = usePushNotifications();

  const checkNearMilestones = useCallback(async (category: "documents" | "quiz" | "lessons" | "badges" | "streak") => {
    if (!isSubscribed) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current progress based on category
      let currentProgress = 0;

      switch (category) {
        case "documents": {
          const { count } = await supabase
            .from("documents")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);
          currentProgress = count || 0;
          break;
        }
        case "quiz": {
          const { count } = await supabase
            .from("quiz_scores")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);
          currentProgress = count || 0;
          break;
        }
        case "lessons": {
          const { count } = await supabase
            .from("micro_lesson_progress")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "completed");
          currentProgress = count || 0;
          break;
        }
        case "badges": {
          const { count } = await supabase
            .from("badges")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);
          currentProgress = count || 0;
          break;
        }
        case "streak": {
          const { data: dailyUsage } = await supabase
            .from("daily_usage_summary")
            .select("date")
            .eq("user_id", user.id)
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
          currentProgress = streak;
          break;
        }
      }

      // Find achievements in this category that are close but not yet unlocked
      const categoryAchievements = ACHIEVEMENT_CONFIGS.filter(a => a.category === category);
      
      for (const achievement of categoryAchievements) {
        const remaining = achievement.target - currentProgress;
        
        // Notify when 1-2 away from unlocking (but not already unlocked)
        if (remaining > 0 && remaining <= 2) {
          const actionVerb = getActionVerb(category);
          const message = remaining === 1
            ? `${actionVerb} 1 more to earn the "${achievement.name}" badge! ${achievement.icon}`
            : `${actionVerb} ${remaining} more to earn the "${achievement.name}" badge! ${achievement.icon}`;
          
          scheduleStudyReminder(
            `Almost there! ${achievement.icon}`,
            message,
            0 // Show immediately
          );
          break; // Only show one notification at a time
        }
      }
    } catch (error) {
      console.error("Error checking near milestones:", error);
    }
  }, [isSubscribed, scheduleStudyReminder]);

  return { checkNearMilestones };
}

function getActionVerb(category: string): string {
  switch (category) {
    case "documents":
      return "Upload";
    case "quiz":
      return "Complete";
    case "lessons":
      return "Finish";
    case "badges":
      return "Earn";
    case "streak":
      return "Study";
    default:
      return "Complete";
  }
}
