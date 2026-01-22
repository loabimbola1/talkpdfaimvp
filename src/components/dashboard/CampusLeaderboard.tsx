import { useState, useEffect } from "react";
import { Trophy, Medal, Crown, Users, Loader2, GraduationCap, Calendar, School } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfWeek, endOfWeek, format } from "date-fns";

interface LeaderboardEntry {
  user_id: string;
  full_name: string | null;
  university: string | null;
  total_badges: number;
  gold_badges: number;
  silver_badges: number;
  bronze_badges: number;
  total_score: number;
}

// Nigerian universities list
const UNIVERSITIES = [
  "University of Lagos (UNILAG)",
  "University of Ibadan (UI)",
  "Obafemi Awolowo University (OAU)",
  "University of Nigeria, Nsukka (UNN)",
  "Ahmadu Bello University (ABU)",
  "University of Benin (UNIBEN)",
  "University of Ilorin (UNILORIN)",
  "Lagos State University (LASU)",
  "Covenant University",
  "Babcock University",
  "University of Port Harcourt (UNIPORT)",
  "Federal University of Technology, Akure (FUTA)",
  "Other",
];

const CampusLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUniversity, setSelectedUniversity] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<"weekly" | "allTime">("weekly");
  const [userUniversity, setUserUniversity] = useState<string | null>(null);

  useEffect(() => {
    fetchUserUniversity();
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedUniversity, timeRange]);

  const fetchUserUniversity = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("university")
          .eq("user_id", user.id)
          .single();
        
        if (profile?.university) {
          setUserUniversity(profile.university);
          // Auto-select user's university
          setSelectedUniversity(profile.university);
        }
      }
    } catch (error) {
      console.error("Error fetching user university:", error);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Get date range for weekly filter
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Fetch badges from secure leaderboard view (only shows opted-in users)
      let query = supabase
        .from("leaderboard_badges")
        .select("user_id, badge_type, score, full_name, university");

      if (selectedUniversity !== "all") {
        query = query.eq("university", selectedUniversity);
      }

      const { data: badges, error: badgesError } = await query;
      if (badgesError) throw badgesError;

      // Aggregate badges by user
      const userStats: Record<string, LeaderboardEntry> = {};

      (badges || []).forEach((badge: any) => {
        if (!userStats[badge.user_id]) {
          userStats[badge.user_id] = {
            user_id: badge.user_id,
            full_name: badge.full_name,
            university: badge.university,
            total_badges: 0,
            gold_badges: 0,
            silver_badges: 0,
            bronze_badges: 0,
            total_score: 0,
          };
        }

        userStats[badge.user_id].total_badges += 1;
        userStats[badge.user_id].total_score += badge.score || 0;

        if (badge.badge_type === "gold") userStats[badge.user_id].gold_badges += 1;
        else if (badge.badge_type === "silver") userStats[badge.user_id].silver_badges += 1;
        else if (badge.badge_type === "bronze") userStats[badge.user_id].bronze_badges += 1;
      });

      // Sort by gold, then silver, then bronze, then total score
      const sorted = Object.values(userStats).sort((a, b) => {
        if (b.gold_badges !== a.gold_badges) return b.gold_badges - a.gold_badges;
        if (b.silver_badges !== a.silver_badges) return b.silver_badges - a.silver_badges;
        if (b.bronze_badges !== a.bronze_badges) return b.bronze_badges - a.bronze_badges;
        return b.total_score - a.total_score;
      });

      setLeaderboard(sorted.slice(0, 20));
    } catch (error) {
      console.error("Error fetching campus leaderboard:", error);
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
    return entry.full_name || "Anonymous Student";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading campus rankings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <School className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Campus Leaderboard
        </h3>
        <p className="text-muted-foreground text-sm">
          Top performers at your university and beyond
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as "weekly" | "allTime")} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="weekly" className="gap-1">
              <Calendar className="h-3 w-3" />
              This Week
            </TabsTrigger>
            <TabsTrigger value="allTime">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
          <SelectTrigger className="w-full sm:w-64">
            <GraduationCap className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select university" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Universities</SelectItem>
            {userUniversity && (
              <SelectItem value={userUniversity}>
                🏠 {userUniversity} (Your Campus)
              </SelectItem>
            )}
            {UNIVERSITIES.filter(uni => uni !== userUniversity).map((uni) => (
              <SelectItem key={uni} value={uni}>{uni}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            No Rankings Yet
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {selectedUniversity !== "all" 
              ? `No students from ${selectedUniversity} have earned badges yet. Be the first!` 
              : "Complete Explain-Back sessions and earn badges to appear on the leaderboard!"}
          </p>
        </div>
      ) : (
        <div className="bg-secondary/30 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Student</div>
            <div className="col-span-3 text-center">Badges</div>
            <div className="col-span-3 text-center">Score</div>
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
                        {entry.university && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.university}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center justify-center gap-1">
                    {entry.gold_badges > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                        🥇 {entry.gold_badges}
                      </span>
                    )}
                    {entry.silver_badges > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-400/20 text-gray-600 dark:text-gray-400">
                        🥈 {entry.silver_badges}
                      </span>
                    )}
                    {entry.bronze_badges > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-600 dark:text-amber-400">
                        🥉 {entry.bronze_badges}
                      </span>
                    )}
                    {entry.total_badges === 0 && (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                  <div className="col-span-3 text-center font-bold text-foreground">
                    {entry.total_score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          Gold (90%+)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-400"></span>
          Silver (75-89%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-amber-600"></span>
          Bronze (60-74%)
        </span>
      </div>
    </div>
  );
};

export default CampusLeaderboard;
