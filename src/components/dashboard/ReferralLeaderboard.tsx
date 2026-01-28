import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Users, TrendingUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReferrerEntry {
  user_id: string;
  full_name: string | null;
  university: string | null;
  referral_credits: number;
  referral_count: number;
}

const ReferralLeaderboard = () => {
  const [topReferrers, setTopReferrers] = useState<ReferrerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      // Get profiles with referral credits from secure leaderboard view (only shows opted-in users)
      const { data: profiles, error: profileError } = await supabase
        .from("leaderboard_profiles")
        .select("user_id, full_name, university, referral_credits")
        .gt("referral_credits", 0)
        .order("referral_credits", { ascending: false })
        .limit(20);

      if (profileError) throw profileError;

      // Get referral counts
      const { data: referrals } = await supabase
        .from("referrals")
        .select("referrer_id, status")
        .eq("status", "completed");

      // Count referrals per user
      const referralCounts: Record<string, number> = {};
      (referrals || []).forEach(r => {
        referralCounts[r.referrer_id] = (referralCounts[r.referrer_id] || 0) + 1;
      });

      const leaderboardData = (profiles || []).map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        university: p.university,
        referral_credits: p.referral_credits || 0,
        referral_count: referralCounts[p.user_id] || 0,
      }));

      setTopReferrers(leaderboardData);

      // Find current user's rank
      if (user) {
        const userIndex = leaderboardData.findIndex(r => r.user_id === user.id);
        if (userIndex !== -1) {
          setCurrentUserRank(userIndex + 1);
        }
      }
    } catch (error) {
      console.error("Error fetching referral leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-chart-4" />;
      case 2:
        return <Medal className="h-5 w-5 text-muted-foreground" />;
      case 3:
        return <Award className="h-5 w-5 text-chart-5" />;
      default:
        return <span className="w-5 text-center text-muted-foreground font-medium">{rank}</span>;
    }
  };

  const getDisplayName = (entry: ReferrerEntry) => {
    if (entry.full_name) return entry.full_name;
    return "Anonymous Champion";
  };

  const getInitials = (name: string | null) => {
    if (!name) return "AC";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Top Referrers</CardTitle>
            <CardDescription>Champions spreading the word</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {topReferrers.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Be the first to climb the referral leaderboard!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Share your referral code to earn credits and rank up.
            </p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {topReferrers.length >= 3 && (
              <div className="flex items-end justify-center gap-4 pb-4 border-b">
                {/* 2nd Place */}
                <div className="flex flex-col items-center">
                  <Avatar className="h-12 w-12 border-2 border-muted-foreground">
                    <AvatarFallback className="bg-secondary">{getInitials(topReferrers[1]?.full_name)}</AvatarFallback>
                  </Avatar>
                  <Medal className="h-5 w-5 text-muted-foreground -mt-2" />
                  <p className="text-xs font-medium mt-1 text-center max-w-16 truncate">
                    {getDisplayName(topReferrers[1])}
                  </p>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {topReferrers[1]?.referral_count} referrals
                  </Badge>
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center -mb-2">
                  <div className="relative">
                    <Avatar className="h-16 w-16 border-2 border-chart-4">
                      <AvatarFallback className="bg-chart-4/20">{getInitials(topReferrers[0]?.full_name)}</AvatarFallback>
                    </Avatar>
                    <Star className="h-5 w-5 text-chart-4 absolute -top-1 -right-1 fill-chart-4" />
                  </div>
                  <Trophy className="h-6 w-6 text-chart-4 -mt-2" />
                  <p className="text-sm font-semibold mt-1 text-center max-w-20 truncate">
                    {getDisplayName(topReferrers[0])}
                  </p>
                  <Badge className="mt-1 bg-chart-4/20 text-chart-4 border-chart-4/30">
                    {topReferrers[0]?.referral_count} referrals
                  </Badge>
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center">
                  <Avatar className="h-12 w-12 border-2 border-chart-5">
                    <AvatarFallback className="bg-chart-5/20">{getInitials(topReferrers[2]?.full_name)}</AvatarFallback>
                  </Avatar>
                  <Award className="h-5 w-5 text-chart-5 -mt-2" />
                  <p className="text-xs font-medium mt-1 text-center max-w-16 truncate">
                    {getDisplayName(topReferrers[2])}
                  </p>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {topReferrers[2]?.referral_count} referrals
                  </Badge>
                </div>
              </div>
            )}

            {/* Rest of Leaderboard */}
            <div className="space-y-2">
              {topReferrers.slice(3, 10).map((referrer, index) => {
                const rank = index + 4;
                const isCurrentUser = referrer.user_id === currentUserId;

                return (
                  <div
                    key={referrer.user_id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      isCurrentUser ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"
                    )}
                  >
                    <div className="w-6 flex items-center justify-center">
                      {getRankIcon(rank)}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-secondary">{getInitials(referrer.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        isCurrentUser && "text-primary"
                      )}>
                        {getDisplayName(referrer)}
                        {isCurrentUser && " (You)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {referrer.referral_count} referrals
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        +{referrer.referral_credits} credits
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current User Position */}
            {currentUserRank && currentUserRank > 10 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center">
                  Your rank: <span className="font-semibold text-foreground">#{currentUserRank}</span>
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralLeaderboard;
