import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserDigestData {
  user_id: string;
  email: string;
  full_name: string | null;
  documents_count: number;
  audio_minutes: number;
  quiz_count: number;
  avg_quiz_score: number;
  badges_earned: { gold: number; silver: number; bronze: number };
  spaced_reviews_due: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[weekly-digest:${requestId}]`;

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) {
      console.error(logPrefix, "Missing RESEND_API_KEY");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(logPrefix, "Missing Supabase credentials");
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(RESEND_API_KEY);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate date range for past week
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString();

    console.log(logPrefix, "Fetching users for weekly digest", { weekAgo: weekAgoISO });

    // Get all active users with email
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .not("email", "is", null);

    if (profilesError) {
      console.error(logPrefix, "Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(logPrefix, `Found ${profiles?.length || 0} users`);

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const profile of profiles || []) {
      try {
        // Gather user's weekly data
        const digestData: UserDigestData = {
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          documents_count: 0,
          audio_minutes: 0,
          quiz_count: 0,
          avg_quiz_score: 0,
          badges_earned: { gold: 0, silver: 0, bronze: 0 },
          spaced_reviews_due: 0,
        };

        // Documents uploaded this week
        const { count: docsCount } = await supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.user_id)
          .gte("created_at", weekAgoISO);
        digestData.documents_count = docsCount || 0;

        // Audio minutes from usage tracking
        const { data: usageData } = await supabase
          .from("usage_tracking")
          .select("audio_minutes_used")
          .eq("user_id", profile.user_id)
          .gte("created_at", weekAgoISO);
        digestData.audio_minutes = Math.round(
          (usageData || []).reduce((sum, u) => sum + Number(u.audio_minutes_used || 0), 0)
        );

        // Quiz scores this week
        const { data: quizData } = await supabase
          .from("quiz_scores")
          .select("score, total_questions")
          .eq("user_id", profile.user_id)
          .gte("created_at", weekAgoISO);
        if (quizData && quizData.length > 0) {
          digestData.quiz_count = quizData.length;
          const totalPercentage = quizData.reduce((sum, q) => 
            sum + (q.score / q.total_questions) * 100, 0);
          digestData.avg_quiz_score = Math.round(totalPercentage / quizData.length);
        }

        // Badges earned this week
        const { data: badgesData } = await supabase
          .from("badges")
          .select("badge_type")
          .eq("user_id", profile.user_id)
          .gte("created_at", weekAgoISO);
        if (badgesData) {
          for (const badge of badgesData) {
            if (badge.badge_type === "gold") digestData.badges_earned.gold++;
            else if (badge.badge_type === "silver") digestData.badges_earned.silver++;
            else if (badge.badge_type === "bronze") digestData.badges_earned.bronze++;
          }
        }

        // Upcoming spaced repetition reviews
        const { count: reviewsDue } = await supabase
          .from("spaced_repetition")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.user_id)
          .lte("next_review_date", new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
        digestData.spaced_reviews_due = reviewsDue || 0;

        // Skip if user has no activity
        const hasActivity = digestData.documents_count > 0 || 
          digestData.quiz_count > 0 || 
          (digestData.badges_earned.gold + digestData.badges_earned.silver + digestData.badges_earned.bronze) > 0;

        if (!hasActivity && digestData.spaced_reviews_due === 0) {
          console.log(logPrefix, `Skipping user ${profile.user_id} - no activity`);
          continue;
        }

        // Generate email HTML
        const emailHtml = generateDigestEmail(digestData);

        // Send email
        const { error: emailError } = await resend.emails.send({
          from: "TalkPDF AI <digest@talkpdfai.com>",
          to: [profile.email],
          subject: `📚 Your Weekly Study Digest - TalkPDF AI`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(logPrefix, `Failed to send email to ${profile.email}:`, emailError);
          emailsFailed++;
        } else {
          console.log(logPrefix, `Sent digest to ${profile.email}`);
          emailsSent++;
        }
      } catch (userError) {
        console.error(logPrefix, `Error processing user ${profile.user_id}:`, userError);
        emailsFailed++;
      }
    }

    console.log(logPrefix, `Digest complete: ${emailsSent} sent, ${emailsFailed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        emailsFailed,
        totalUsers: profiles?.length || 0 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(logPrefix, "Error in weekly digest:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateDigestEmail(data: UserDigestData): string {
  const name = data.full_name || "Student";
  const totalBadges = data.badges_earned.gold + data.badges_earned.silver + data.badges_earned.bronze;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Study Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #10b981; margin: 0;">📚 TalkPDF AI</h1>
    <p style="color: #666; margin: 5px 0;">Your Weekly Study Digest</p>
  </div>

  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 16px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 10px 0;">Hey ${name}! 👋</h2>
    <p style="margin: 0; opacity: 0.9;">Here's how you did this week</p>
  </div>

  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
    <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; text-align: center;">
      <div style="font-size: 32px; font-weight: bold; color: #10b981;">${data.documents_count}</div>
      <div style="color: #666; font-size: 14px;">PDFs Uploaded</div>
    </div>
    <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; text-align: center;">
      <div style="font-size: 32px; font-weight: bold; color: #10b981;">${data.audio_minutes}</div>
      <div style="color: #666; font-size: 14px;">Audio Minutes</div>
    </div>
    <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; text-align: center;">
      <div style="font-size: 32px; font-weight: bold; color: #10b981;">${data.quiz_count}</div>
      <div style="color: #666; font-size: 14px;">Quizzes Taken</div>
    </div>
    <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; text-align: center;">
      <div style="font-size: 32px; font-weight: bold; color: #10b981;">${data.avg_quiz_score}%</div>
      <div style="color: #666; font-size: 14px;">Avg Quiz Score</div>
    </div>
  </div>

  ${totalBadges > 0 ? `
  <div style="background: #fef3c7; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
    <h3 style="margin: 0 0 15px 0; color: #92400e;">🏆 Badges Earned This Week</h3>
    <div style="display: flex; gap: 15px; justify-content: center;">
      ${data.badges_earned.gold > 0 ? `<span style="font-size: 24px;">🥇 x${data.badges_earned.gold}</span>` : ''}
      ${data.badges_earned.silver > 0 ? `<span style="font-size: 24px;">🥈 x${data.badges_earned.silver}</span>` : ''}
      ${data.badges_earned.bronze > 0 ? `<span style="font-size: 24px;">🥉 x${data.badges_earned.bronze}</span>` : ''}
    </div>
  </div>
  ` : ''}

  ${data.spaced_reviews_due > 0 ? `
  <div style="background: #dbeafe; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
    <h3 style="margin: 0 0 10px 0; color: #1e40af;">📅 Upcoming Reviews</h3>
    <p style="margin: 0; color: #3b82f6;">
      You have <strong>${data.spaced_reviews_due}</strong> spaced repetition review${data.spaced_reviews_due !== 1 ? 's' : ''} due this week!
    </p>
  </div>
  ` : ''}

  <div style="text-align: center; margin: 30px 0;">
    <a href="https://talkpdfaimvp.lovable.app/dashboard" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      Continue Studying →
    </a>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
    <p>TalkPDF AI - Learn Smarter, Not Harder</p>
    <p style="margin: 5px 0;">
      <a href="https://talkpdfaimvp.lovable.app" style="color: #10b981;">Visit Website</a> • 
      <a href="https://talkpdfaimvp.lovable.app/help" style="color: #10b981;">Help Center</a>
    </p>
  </div>
</body>
</html>
  `;
}
