import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Share2,
  Twitter,
  Facebook,
  MessageCircle,
  Copy,
  Check,
  Trophy,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Achievement } from "@/hooks/useAchievements";
import { cn } from "@/lib/utils";

interface AchievementShareCardProps {
  achievement: Achievement;
  isOpen: boolean;
  onClose: () => void;
}

const AchievementShareCard = ({ achievement, isOpen, onClose }: AchievementShareCardProps) => {
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://www.talkpdf.online`;
  const shareText = `🏆 I just unlocked the "${achievement.name}" achievement on TalkPDF AI!\n\n${achievement.description}\n\n📚 Join me and start learning smarter!`;

  const handleShare = (platform: string) => {
    let url = "";
    
    switch (platform) {
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
        break;
      case "whatsapp":
        url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
        break;
      case "copy":
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Achievement copied to clipboard!");
        return;
    }

    if (url) {
      window.open(url, "_blank", "width=600,height=400");
      toast.success(`Sharing to ${platform}!`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Share Your Achievement</DialogTitle>
          <DialogDescription className="text-center">
            Celebrate your success with friends!
          </DialogDescription>
        </DialogHeader>

        {/* Achievement Preview Card */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-primary/30 p-6">
          {/* Decorative elements */}
          <div className="absolute top-2 right-2">
            <Sparkles className="h-5 w-5 text-primary/50" />
          </div>
          <div className="absolute bottom-2 left-2">
            <Sparkles className="h-4 w-4 text-primary/30" />
          </div>
          
          <div className="flex flex-col items-center text-center space-y-3">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-3xl">
              {achievement.icon}
            </div>
            
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Achievement Unlocked</span>
            </div>
            
            {/* Title & Description */}
            <h3 className="font-display text-xl font-bold text-foreground">
              {achievement.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {achievement.description}
            </p>
            
            {/* Branding */}
            <div className="pt-2 border-t border-border/50 w-full">
              <p className="text-xs text-muted-foreground">
                TalkPDF AI • Learn Smarter
              </p>
            </div>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
            className="gap-2 bg-[#1DA1F2]/10 border-[#1DA1F2]/30 hover:bg-[#1DA1F2]/20 text-[#1DA1F2]"
            onClick={() => handleShare("twitter")}
          >
            <Twitter className="h-4 w-4" />
            Twitter/X
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-[#1877F2]/10 border-[#1877F2]/30 hover:bg-[#1877F2]/20 text-[#1877F2]"
            onClick={() => handleShare("facebook")}
          >
            <Facebook className="h-4 w-4" />
            Facebook
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-[#25D366]/10 border-[#25D366]/30 hover:bg-[#25D366]/20 text-[#25D366]"
            onClick={() => handleShare("whatsapp")}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => handleShare("copy")}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AchievementShareCard;
