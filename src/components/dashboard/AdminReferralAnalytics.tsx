import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Gift, TrendingUp, Trophy, AlertTriangle, Shield, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalCreditsAwarded: number;
  suspiciousCount: number;
}

interface TopReferrer {
  user_id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
  referral_credits: number;
  referral_count: number;
}

interface SuspiciousReferral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  status: string;
  flagged_suspicious: boolean;
  credits_awarded: number | null;
}

const AdminReferralAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalCreditsAwarded: 0,
    suspiciousCount: 0,
  });
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<any[]>([]);
  const [suspiciousReferrals, setSuspiciousReferrals] = useState<SuspiciousReferral[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      
      // Identify suspicious referrals
      // 1. Flagged explicitly
      const flagged = referrals?.filter(r => r.flagged_suspicious) || [];
      
      // 2. Check for IP patterns (same IP used 3+ times)
      const ipCounts: Record<string, number> = {};
      referrals?.forEach(r => {
        if (r.ip_address) {
          ipCounts[r.ip_address] = (ipCounts[r.ip_address] || 0) + 1;
        }
      });
      const suspiciousIPs = new Set(
        Object.entries(ipCounts)
          .filter(([_, count]) => count >= 3)
          .map(([ip]) => ip)
      );
      
      // Combine flagged and IP-suspicious
      const suspicious = (referrals || []).filter(r => 
        r.flagged_suspicious || (r.ip_address && suspiciousIPs.has(r.ip_address))
      );

      setStats({
        totalReferrals: referrals?.length || 0,
        completedReferrals: completed.length,
        pendingReferrals: pending.length,
        totalCreditsAwarded: totalCredits,
        suspiciousCount: suspicious.length,
      });

      // Get recent referrals with user info
      setRecentReferrals((referrals || []).slice(0, 10));
      setSuspiciousReferrals(suspicious as SuspiciousReferral[]);

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

  const handleDismissFlag = async (referralId: string) => {
    setProcessingId(referralId);
    try {
      const { error } = await supabase
        .from("referrals")
        .update({ flagged_suspicious: false })
        .eq("id", referralId);

      if (error) throw error;
      
      toast.success("Flag dismissed - marked as legitimate");
      await fetchReferralData();
    } catch (error) {
      console.error("Error dismissing flag:", error);
      toast.error("Failed to dismiss flag");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevokeCredits = async (referral: SuspiciousReferral) => {
    setProcessingId(referral.id);
    try {
      // Revoke credits from referrer
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          referral_credits: supabase.rpc ? 0 : 0 // Reset to 0 or decrement
        })
        .eq("user_id", referral.referrer_id);

      // Update referral status
      const { error: refError } = await supabase
        .from("referrals")
        .update({ 
          status: "revoked",
          credits_awarded: 0,
          flagged_suspicious: true
        })
        .eq("id", referral.id);

      if (profileError || refError) throw profileError || refError;
      
      toast.success("Credits revoked and referral flagged");
      await fetchReferralData();
    } catch (error) {
      console.error("Error revoking credits:", error);
      toast.error("Failed to revoke credits");
    } finally {
      setProcessingId(null);
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
        <Card className={stats.suspiciousCount > 0 ? "border-yellow-500/50" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Suspicious
            </CardDescription>
            <CardTitle className={`text-3xl ${stats.suspiciousCount > 0 ? "text-yellow-600" : ""}`}>
              {stats.suspiciousCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="top-referrers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="top-referrers">Top Referrers</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
          <TabsTrigger value="suspicious" className="relative">
            Suspicious Activity
            {stats.suspiciousCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5">
                {stats.suspiciousCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Top Referrers Tab */}
        <TabsContent value="top-referrers">
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
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="recent">
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
        </TabsContent>

        {/* Suspicious Activity Tab */}
        <TabsContent value="suspicious">
          <Card className="border-yellow-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-yellow-600" />
                Suspicious Referral Activity
              </CardTitle>
              <CardDescription>
                Flagged referrals and patterns that may indicate abuse (same IP 3+ times, rapid signups)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referral Code</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suspiciousReferrals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Check className="h-8 w-8 text-green-500" />
                          <span>No suspicious activity detected</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    suspiciousReferrals.map((referral) => (
                      <TableRow key={referral.id} className="bg-yellow-500/5">
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {referral.referral_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {referral.ip_address || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={referral.status === "completed" ? "default" : "secondary"}
                            >
                              {referral.status}
                            </Badge>
                            {referral.flagged_suspicious && (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{referral.credits_awarded || 0}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDismissFlag(referral.id)}
                              disabled={processingId === referral.id}
                            >
                              {processingId === referral.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              <span className="sr-only md:not-sr-only md:ml-1">Dismiss</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevokeCredits(referral)}
                              disabled={processingId === referral.id || referral.status === "revoked"}
                            >
                              {processingId === referral.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                              <span className="sr-only md:not-sr-only md:ml-1">Revoke</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminReferralAnalytics;
