import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Gift, TrendingUp, Trophy } from "lucide-react";

interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalCreditsAwarded: number;
}

interface TopReferrer {
  user_id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
  referral_credits: number;
  referral_count: number;
}

const AdminReferralAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalCreditsAwarded: 0,
  });
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<any[]>([]);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      // Fetch all referrals
      const { data: referrals, error: refError } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });

      if (refError) throw refError;

      // Calculate stats
      const completed = referrals?.filter(r => r.status === "completed") || [];
      const pending = referrals?.filter(r => r.status === "pending") || [];
      const totalCredits = completed.reduce((sum, r) => sum + (r.credits_awarded || 0), 0);

      setStats({
        totalReferrals: referrals?.length || 0,
        completedReferrals: completed.length,
        pendingReferrals: pending.length,
        totalCreditsAwarded: totalCredits,
      });

      // Get recent referrals with user info
      setRecentReferrals((referrals || []).slice(0, 10));

      // Fetch top referrers from profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, referral_code, referral_credits")
        .gt("referral_credits", 0)
        .order("referral_credits", { ascending: false })
        .limit(10);

      if (profileError) throw profileError;

      // Count referrals per user
      const referrerCounts: Record<string, number> = {};
      (referrals || []).forEach(r => {
        if (r.status === "completed") {
          referrerCounts[r.referrer_id] = (referrerCounts[r.referrer_id] || 0) + 1;
        }
      });

      const topReferrersWithCount = (profiles || []).map(p => ({
        ...p,
        referral_count: referrerCounts[p.user_id] || 0,
      }));

      setTopReferrers(topReferrersWithCount);
    } catch (error) {
      console.error("Error fetching referral data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Referrals
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalReferrals}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Completed
            </CardDescription>
            <CardTitle className="text-3xl text-primary">{stats.completedReferrals}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Credits Awarded
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalCreditsAwarded}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Pending
            </CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{stats.pendingReferrals}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Top Referrers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Top Referrers
          </CardTitle>
          <CardDescription>Users with the most successful referrals</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Referral Code</TableHead>
                <TableHead>Referrals</TableHead>
                <TableHead>Credits Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topReferrers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No referrals yet
                  </TableCell>
                </TableRow>
              ) : (
                topReferrers.map((referrer, index) => (
                  <TableRow key={referrer.user_id}>
                    <TableCell>
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                    </TableCell>
                    <TableCell className="font-medium">{referrer.full_name || "N/A"}</TableCell>
                    <TableCell className="text-muted-foreground">{referrer.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {referrer.referral_code || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{referrer.referral_count}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        +{referrer.referral_credits}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Referrals</CardTitle>
          <CardDescription>Latest referral activity</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referral Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReferrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No referrals yet
                  </TableCell>
                </TableRow>
              ) : (
                recentReferrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {referral.referral_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={referral.status === "completed" ? "default" : "secondary"}
                      >
                        {referral.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{referral.credits_awarded || 0}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(referral.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReferralAnalytics;
