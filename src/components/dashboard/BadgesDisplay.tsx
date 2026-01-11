import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Award, 
  Share2, 
  Trophy,
  Star,
  Loader2,
  Twitter,
  Facebook,
  Linkedin,
  Copy,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Badge {
  id: string;
  badge_type: string;
  badge_name: string;
  description: string | null;
  document_id: string | null;
  score: number | null;
  earned_at: string;
  shared_on: string[] | null;
}

const BADGE_CONFIG: Record<string, { icon: typeof Award; color: string; bgColor: string }> = {
  first_concept: { icon: Star, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  rising_star: { icon: Star, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  quick_learner: { icon: Trophy, color: "text-green-500", bgColor: "bg-green-500/10" },
  master_explainer: { icon: Award, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  perfect_score: { icon: Trophy, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  document_master: { icon: Award, color: "text-primary", bgColor: "bg-primary/10" },
};

const BadgesDisplay = () => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const { data, error } = await supabase
        .from("badges")
        .select("*")
        .order("earned_at", { ascending: false });

      if (error) throw error;
      setBadges(data || []);
    } catch (error) {
      console.error("Error fetching badges:", error);
    } finally {
      setLoading(false);
    }
  };

  const shareBadge = async (badge: Badge, platform: string) => {
    const shareText = `🎉 I just earned the "${badge.badge_name}" badge on TalkPDF AI!${badge.score ? ` Score: ${badge.score}%` : ""} #TalkPDFAI #Learning`;
    const shareUrl = `${window.location.origin}?badge=${badge.id}`;

    let shareLink = "";
    switch (platform) {
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
        break;
      case "linkedin":
        shareLink = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(badge.badge_name)}&summary=${encodeURIComponent(shareText)}`;
        break;
      case "copy":
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setCopiedId(badge.id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success("Badge link copied to clipboard!");
        
        // Update shared_on array
        const newSharedOn = [...(badge.shared_on || []), "copy"];
        await supabase
          .from("badges")
          .update({ shared_on: newSharedOn })
          .eq("id", badge.id);
        return;
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "width=600,height=400");
      
      // Update shared_on array
      const newSharedOn = [...(badge.shared_on || []), platform];
      await supabase
        .from("badges")
        .update({ shared_on: newSharedOn })
        .eq("id", badge.id);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your badges...</p>
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
          <Award className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          No Badges Yet
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Complete the Explain-Back exercises to earn badges! Score well on concepts to unlock achievements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Your Achievements
        </h3>
        <p className="text-muted-foreground text-sm">
          {badges.length} badge{badges.length !== 1 ? "s" : ""} earned • Share your success!
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {badges.map((badge) => {
          const config = BADGE_CONFIG[badge.badge_type] || BADGE_CONFIG.first_concept;
          const BadgeIcon = config.icon;

          return (
            <div
              key={badge.id}
              className="bg-secondary/30 rounded-xl p-4 border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", config.bgColor)}>
                  <BadgeIcon className={cn("h-6 w-6", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-foreground truncate">{badge.badge_name}</h4>
                    {badge.score && (
                      <span className={cn("text-sm font-bold", config.color)}>
                        {badge.score}%
                      </span>
                    )}
                  </div>
                  {badge.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {badge.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(badge.earned_at)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
                          <Share2 className="h-3 w-3" />
                          <span className="text-xs">Share</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => shareBadge(badge, "twitter")}>
                          <Twitter className="h-4 w-4 mr-2" />
                          Twitter/X
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareBadge(badge, "facebook")}>
                          <Facebook className="h-4 w-4 mr-2" />
                          Facebook
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareBadge(badge, "linkedin")}>
                          <Linkedin className="h-4 w-4 mr-2" />
                          LinkedIn
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareBadge(badge, "copy")}>
                          {copiedId === badge.id ? (
                            <Check className="h-4 w-4 mr-2 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 mr-2" />
                          )}
                          Copy Link
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BadgesDisplay;
