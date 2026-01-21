import { useState, useEffect } from "react";
import { Trophy, Medal, Award, Crown, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  user_id: string;
  email: string;
  full_name: string | null;
  total_badges: number;
  gold_badges: number;
  silver_badges: number;
  bronze_badges: number;
  avg_score: number;
}

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Get badges from secure leaderboard view (only shows opted-in users)
      const { data: badges, error: badgesError } = await supabase
        .from("leaderboard_badges")
        .select("user_id, badge_type, score, full_name, email");

      if (badgesError) throw badgesError;

      // Aggregate badges by user from secure view data
      const userStats: Record<string, LeaderboardEntry> = {};

      (badges || []).forEach((badge: any) => {
        if (!userStats[badge.user_id]) {
          userStats[badge.user_id] = {
            user_id: badge.user_id,
            email: badge.email || "Anonymous",
            full_name: badge.full_name,
            total_badges: 0,
            gold_badges: 0,
            silver_badges: 0,
            bronze_badges: 0,
            avg_score: 0,
          };
        }

        userStats[badge.user_id].total_badges += 1;
        
        if (badge.badge_type === "gold") {
          userStats[badge.user_id].gold_badges += 1;
        } else if (badge.badge_type === "silver") {
          userStats[badge.user_id].silver_badges += 1;
        } else if (badge.badge_type === "bronze") {
          userStats[badge.user_id].bronze_badges += 1;
        }

        if (badge.score) {
          const current = userStats[badge.user_id];
          current.avg_score = (current.avg_score * (current.total_badges - 1) + badge.score) / current.total_badges;
        }
      });

      // Sort by gold badges, then silver, then bronze, then avg score
      const sorted = Object.values(userStats).sort((a, b) => {
        if (b.gold_badges !== a.gold_badges) return b.gold_badges - a.gold_badges;
        if (b.silver_badges !== a.silver_badges) return b.silver_badges - a.silver_badges;
        if (b.bronze_badges !== a.bronze_badges) return b.bronze_badges - a.bronze_badges;
        return b.avg_score - a.avg_score;
      });

      setLeaderboard(sorted.slice(0, 10)); // Top 10
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground font-medium w-5 text-center">{rank}</span>;
    }
  };

  const getDisplayName = (entry: LeaderboardEntry) => {
    if (entry.full_name) return entry.full_name;
    if (entry.email) {
      const [local] = entry.email.split("@");
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return "Anonymous";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading leaderboard...</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          No Rankings Yet
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Be the first to earn badges and top the leaderboard! Complete Explain-Back exercises to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Top Scholars
        </h3>
        <p className="text-muted-foreground text-sm">
          Students ranked by badges earned and scores achieved
        </p>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-secondary/30 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Student</div>
          <div className="col-span-2 text-center">🥇</div>
          <div className="col-span-2 text-center">🥈</div>
          <div className="col-span-2 text-center">🥉</div>
        </div>

        <div className="divide-y divide-border">
          {leaderboard.map((entry, index) => {
            const isCurrentUser = entry.user_id === currentUserId;
            const rank = index + 1;

            return (
              <div
                key={entry.user_id}
                className={cn(
                  "grid grid-cols-12 gap-2 px-4 py-3 items-center",
                  isCurrentUser && "bg-primary/5 border-l-2 border-primary",
                  rank <= 3 && "bg-secondary/20"
                )}
              >
                <div className="col-span-1 flex justify-center">
                  {getRankIcon(rank)}
                </div>
                <div className="col-span-5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {getDisplayName(entry).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate text-sm">
                        {getDisplayName(entry)}
                        {isCurrentUser && <span className="text-primary ml-1">(You)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg: {Math.round(entry.avg_score)}%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-center font-medium text-yellow-600">
                  {entry.gold_badges}
                </div>
                <div className="col-span-2 text-center font-medium text-gray-500">
                  {entry.silver_badges}
                </div>
                <div className="col-span-2 text-center font-medium text-amber-700">
                  {entry.bronze_badges}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Award className="h-3 w-3 text-yellow-500" /> Gold (90%+)
        </span>
        <span className="flex items-center gap-1">
          <Award className="h-3 w-3 text-gray-400" /> Silver (70-89%)
        </span>
        <span className="flex items-center gap-1">
          <Award className="h-3 w-3 text-amber-600" /> Bronze (50-69%)
        </span>
      </div>
    </div>
  );
};

export default Leaderboard;
