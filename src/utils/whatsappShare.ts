import { MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppShareOptions {
  text: string;
  url?: string;
}

export const shareToWhatsApp = ({ text, url }: WhatsAppShareOptions) => {
  const fullText = url ? `${text}\n${url}` : text;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
  window.open(whatsappUrl, "_blank");
};

export const shareStudyGroupInvite = (groupName: string, inviteCode: string) => {
  const text = `🎓 Join my study group "${groupName}" on TalkPDF AI!\n\n📚 We're learning together and competing on leaderboards.\n\n🔑 Use invite code: ${inviteCode}`;
  const url = `https://talkpdfaimvp.lovable.app/dashboard?tab=groups`;
  
  shareToWhatsApp({ text, url });
  toast.success("Opening WhatsApp to share invite!");
};

export const shareBadgeAchievement = (
  badgeName: string, 
  score: number | null, 
  description?: string
) => {
  let text = `🏆 I just earned the "${badgeName}" badge on TalkPDF AI!`;
  
  if (score) {
    text += `\n\n📊 Score: ${score}%`;
  }
  
  if (description) {
    text += `\n\n${description}`;
  }
  
  text += `\n\n📱 Start learning smarter at TalkPDF AI!`;
  
  const url = `https://talkpdfaimvp.lovable.app`;
  
  shareToWhatsApp({ text, url });
  toast.success("Opening WhatsApp to share your achievement!");
};

export const shareQuizScore = (
  documentTitle: string,
  score: number,
  totalQuestions: number
) => {
  const percentage = Math.round((score / totalQuestions) * 100);
  let emoji = "📝";
  if (percentage >= 90) emoji = "🏆";
  else if (percentage >= 70) emoji = "🌟";
  else if (percentage >= 50) emoji = "💪";

  const text = `${emoji} I scored ${score}/${totalQuestions} (${percentage}%) on a quiz about "${documentTitle}" on TalkPDF AI!\n\n📚 Test your knowledge too!`;
  const url = `https://talkpdfaimvp.lovable.app`;
  
  shareToWhatsApp({ text, url });
  toast.success("Opening WhatsApp to share your score!");
};
