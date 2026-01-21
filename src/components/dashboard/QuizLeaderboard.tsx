import { useState, useEffect } from "react";
import { Trophy, Medal, Crown, Users, Loader2, GraduationCap, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";

interface LeaderboardEntry {
  user_id: string;
  email: string;
  full_name: string | null;
  university: string | null;
  total_quizzes: number;
  avg_score: number;
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

const QuizLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUniversity, setSelectedUniversity] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<"weekly" | "allTime">("weekly");

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedUniversity, timeRange]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Get date range for weekly filter
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Fetch quiz scores from secure leaderboard view (only shows opted-in users)
      let query = supabase
        .from("leaderboard_quiz_scores")
        .select("user_id, score, total_questions, completed_at, full_name, university");

      if (timeRange === "weekly") {
        query = query
          .gte("completed_at", weekStart.toISOString())
          .lte("completed_at", weekEnd.toISOString());
      }

      if (selectedUniversity !== "all") {
        query = query.eq("university", selectedUniversity);
      }

      const { data: scores, error: scoresError } = await query;
      if (scoresError) throw scoresError;

      // Aggregate scores by user from the secure view data
      const userStats: Record<string, LeaderboardEntry> = {};

      (scores || []).forEach((score: any) => {
        if (!userStats[score.user_id]) {
          userStats[score.user_id] = {
            user_id: score.user_id,
            email: "Anonymous", // Email not exposed in leaderboard view for privacy
            full_name: score.full_name,
            university: score.university,
            total_quizzes: 0,
            avg_score: 0,
            total_score: 0,
          };
        }

        const percentage = Math.round((score.score / score.total_questions) * 100);
        userStats[score.user_id].total_quizzes += 1;
        userStats[score.user_id].total_score += percentage;
      });

      // Calculate average scores
      Object.values(userStats).forEach((stat) => {
        stat.avg_score = Math.round(stat.total_score / stat.total_quizzes);
      });

      // Sort by average score, then by total quizzes
      const sorted = Object.values(userStats).sort((a, b) => {
        if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
        return b.total_quizzes - a.total_quizzes;
      });

      setLeaderboard(sorted.slice(0, 20));
    } catch (error) {
      console.error("Error fetching quiz leaderboard:", error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Quiz Leaderboard
        </h3>
        <p className="text-muted-foreground text-sm">
          Top scorers ranked by quiz performance
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
            <SelectValue placeholder="Filter by university" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Universities</SelectItem>
            {UNIVERSITIES.map((uni) => (
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
            No Quiz Data Yet
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {timeRange === "weekly" 
              ? "No quizzes completed this week. Be the first!" 
              : "Complete quizzes to appear on the leaderboard!"}
          </p>
        </div>
      ) : (
        <div className="bg-secondary/30 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Student</div>
            <div className="col-span-3 text-center">Quizzes</div>
            <div className="col-span-3 text-center">Avg Score</div>
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
                  <div className="col-span-3 text-center font-medium text-foreground">
                    {entry.total_quizzes}
                  </div>
                  <div className={cn(
                    "col-span-3 text-center font-bold",
                    entry.avg_score >= 80 ? "text-green-500" :
                    entry.avg_score >= 60 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {entry.avg_score}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizLeaderboard;
