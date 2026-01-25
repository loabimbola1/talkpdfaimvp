import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Users, Copy, Check, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReferralStats {
  referralCode: string | null;
  totalCredits: number;
  completedReferrals: number;
  pendingReferrals: number;
  creditsPerReferral: number;
}

export function ReferralProgram() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("referral", {
        body: { action: "get-stats" }
      });

      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch referral stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCode = async () => {
    if (!inputCode.trim()) {
      toast.error("Please enter a referral code");
      return;
    }

    setIsApplying(true);
    try {
      // First validate
      const { data: validateData, error: validateError } = await supabase.functions.invoke("referral", {
        body: { action: "validate", referralCode: inputCode.trim() }
      });

      if (validateError) throw validateError;
      
      if (!validateData.valid) {
        toast.error(validateData.error || "Invalid referral code");
        return;
      }

      // Then apply
      const { data, error } = await supabase.functions.invoke("referral", {
        body: { action: "apply", referralCode: inputCode.trim() }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setInputCode("");
        fetchStats();
      } else {
        toast.error(data.error || "Failed to apply referral code");
      }
    } catch (error) {
      console.error("Apply referral error:", error);
      toast.error("Failed to apply referral code");
    } finally {
      setIsApplying(false);
    }
  };

  const copyCode = async () => {
    if (!stats?.referralCode) return;
    
    try {
      await navigator.clipboard.writeText(stats.referralCode);
      setIsCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  };

  const shareReferral = async () => {
    if (!stats?.referralCode) return;

    const shareText = `Join TalkPDF AI - the best way to study with AI tutors in Nigerian languages! Use my referral code ${stats.referralCode} to get ${stats.creditsPerReferral} free PDF credits. 📚🎧`;
    const shareUrl = `https://www.talkpdf.online/auth?ref=${stats.referralCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join TalkPDF AI",
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or share failed
        copyCode();
      }
    } else {
      copyCode();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Your Referral Code */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Your Referral Code
          </CardTitle>
          <CardDescription>
            Share your code with friends. You both get {stats?.creditsPerReferral || 5} bonus PDF credits when they sign up!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-background border rounded-lg px-4 py-3 font-mono text-lg font-bold tracking-wider text-center">
              {stats?.referralCode || "Loading..."}
            </div>
            <Button variant="outline" size="icon" onClick={copyCode}>
              {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button onClick={shareReferral} className="gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Credits Earned</p>
                <p className="text-2xl font-bold text-primary">{stats?.totalCredits || 0}</p>
              </div>
              <Gift className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Friends Referred</p>
                <p className="text-2xl font-bold">{stats?.completedReferrals || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Credits Per Referral</p>
                <p className="text-2xl font-bold text-green-600">{stats?.creditsPerReferral || 5}</p>
              </div>
              <Badge variant="secondary">PDF Credits</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Apply Code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Have a Referral Code?</CardTitle>
          <CardDescription>
            Enter a friend's referral code to get bonus PDF credits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter referral code"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
              maxLength={8}
            />
            <Button onClick={handleApplyCode} disabled={isApplying || !inputCode.trim()}>
              {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How Referrals Work</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">1</span>
              <span>Share your unique referral code with friends</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">2</span>
              <span>They sign up and enter your code in their dashboard</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">3</span>
              <span>You both get {stats?.creditsPerReferral || 5} bonus PDF credits instantly!</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
