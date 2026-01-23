import { useState } from "react";
import { useAchievements, Achievement } from "@/hooks/useAchievements";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Loader2, Lock, CheckCircle2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import AchievementShareCard from "./AchievementShareCard";

interface AchievementCardProps {
  achievement: Achievement;
  onShare: (achievement: Achievement) => void;
}

const AchievementCard = ({ achievement, onShare }: AchievementCardProps) => {
  const progressPercent = (achievement.progress / achievement.target) * 100;

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border transition-all duration-300",
        achievement.unlocked
          ? "bg-primary/5 border-primary/30 shadow-sm"
          : "bg-secondary/30 border-border/50"
      )}
    >
      {/* Icon */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
            achievement.unlocked
              ? "bg-primary/10"
              : "bg-muted grayscale opacity-50"
          )}
        >
          {achievement.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={cn(
                "font-medium text-sm",
                achievement.unlocked ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {achievement.name}
            </h4>
            {achievement.unlocked ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {achievement.description}
          </p>

          {/* Progress bar or Share button */}
          {achievement.unlocked ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-7 px-2 text-xs"
              onClick={() => onShare(achievement)}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          ) : (
            <div className="space-y-1">
              <Progress value={progressPercent} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {achievement.progress} / {achievement.target}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AchievementMilestones = () => {
  const { achievements, loading, unlockedCount, totalCount } = useAchievements();
  const [shareAchievement, setShareAchievement] = useState<Achievement | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const categories = [
    { id: "all", label: "All", filter: () => true },
    { id: "documents", label: "PDFs", filter: (a: Achievement) => a.id.includes("pdf") },
    { id: "quiz", label: "Quizzes", filter: (a: Achievement) => a.id.includes("quiz") },
    { id: "lessons", label: "Lessons", filter: (a: Achievement) => a.id.includes("lesson") },
    { id: "badges", label: "Badges", filter: (a: Achievement) => a.id.includes("badge") },
    { id: "streak", label: "Streaks", filter: (a: Achievement) => a.id.includes("streak") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          Achievement Milestones
        </h2>
        <p className="text-muted-foreground">
          Track your progress and unlock achievements
        </p>
      </div>

      {/* Progress Summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">
              Overall Progress
            </span>
            <span className="text-sm text-muted-foreground">
              {unlockedCount} / {totalCount} unlocked
            </span>
          </div>
          <Progress
            value={(unlockedCount / totalCount) * 100}
            className="h-3"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {Math.round((unlockedCount / totalCount) * 100)}% complete
          </p>
        </CardContent>
      </Card>

      {/* Tabbed Categories */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full flex-wrap h-auto p-1 gap-1">
          {categories.map((cat) => (
            <TabsTrigger
              key={cat.id}
              value={cat.id}
              className="flex-1 min-w-[80px] text-xs"
            >
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {achievements
                .filter(cat.filter)
                .sort((a, b) => {
                  // Sort: unlocked first, then by progress percentage
                  if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
                  return b.progress / b.target - a.progress / a.target;
                })
                .map((achievement) => (
                  <AchievementCard 
                    key={achievement.id} 
                    achievement={achievement} 
                    onShare={setShareAchievement}
                  />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Share Dialog */}
      {shareAchievement && (
        <AchievementShareCard
          achievement={shareAchievement}
          isOpen={!!shareAchievement}
          onClose={() => setShareAchievement(null)}
        />
      )}
    </div>
  );
};

export default AchievementMilestones;
