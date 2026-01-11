import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Flame, 
  Award, 
  BookOpen, 
  TrendingUp,
  Loader2,
  Calendar,
  FileText,
  Brain,
  Clock,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

interface ProgressDashboardProps {
  onNavigate?: (tab: string) => void;
}

interface StudyStreak {
  date: string;
  minutes: number;
}

interface BadgeStats {
  name: string;
  count: number;
  color: string;
}

interface SubjectMastery {
  subject: string;
  mastery: number;
}

interface DocumentProgress {
  id: string;
  title: string;
  score: number | null;
  lastStudied: string | null;
  status: string;
}

const ProgressDashboard = ({ onNavigate }: ProgressDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [streakDays, setStreakDays] = useState(0);
  const [totalBadges, setTotalBadges] = useState(0);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [studyData, setStudyData] = useState<StudyStreak[]>([]);
  const [badgeStats, setBadgeStats] = useState<BadgeStats[]>([]);
  const [subjectMastery, setSubjectMastery] = useState<SubjectMastery[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<DocumentProgress[]>([]);

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch badges
      const { data: badges, error: badgesError } = await supabase
        .from("badges")
        .select("*")
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });

      if (badgesError) throw badgesError;

      setTotalBadges(badges?.length || 0);

      // Calculate badge stats by type
      const badgeCounts: Record<string, number> = {};
      badges?.forEach((badge) => {
        const type = badge.badge_type || "other";
        badgeCounts[type] = (badgeCounts[type] || 0) + 1;
      });

      const badgeColors: Record<string, string> = {
        gold: "hsl(45, 93%, 47%)",
        silver: "hsl(0, 0%, 66%)",
        bronze: "hsl(30, 60%, 50%)",
        first_concept: "hsl(45, 93%, 47%)",
        rising_star: "hsl(200, 80%, 50%)",
        quick_learner: "hsl(120, 60%, 45%)",
        master_explainer: "hsl(280, 70%, 55%)",
        perfect_score: "hsl(35, 90%, 55%)",
      };

      setBadgeStats(
        Object.entries(badgeCounts).map(([name, count]) => ({
          name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          count,
          color: badgeColors[name] || "hsl(var(--primary))",
        }))
      );

      // Fetch documents for progress tracking
      const { data: documents, error: docsError } = await supabase
        .from("documents")
        .select("id, title, explain_back_score, last_studied_at, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (docsError) throw docsError;

      setTotalDocuments(documents?.length || 0);
      
      // Recent documents with progress
      setRecentDocuments(
        (documents || []).slice(0, 5).map((doc) => ({
          id: doc.id,
          title: doc.title,
          score: doc.explain_back_score,
          lastStudied: doc.last_studied_at,
          status: doc.status,
        }))
      );

      // Calculate subject mastery from document scores
      const subjectScores: Record<string, number[]> = {};
      documents?.forEach((doc) => {
        const subject = doc.title?.split(" ")[0] || "General";
        if (!subjectScores[subject]) subjectScores[subject] = [];
        if (doc.explain_back_score) {
          subjectScores[subject].push(doc.explain_back_score);
        }
      });

      const masteryData = Object.entries(subjectScores)
        .map(([subject, scores]) => ({
          subject,
          mastery: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        }))
        .slice(0, 5);

      // Add sample data if empty
      if (masteryData.length === 0 && documents && documents.length > 0) {
        masteryData.push(
          ...documents.slice(0, 4).map((doc, i) => ({
            subject: doc.title.slice(0, 15),
            mastery: doc.explain_back_score || (70 + i * 5),
          }))
        );
      }

      setSubjectMastery(masteryData);

      // Fetch micro lesson progress
      const { data: lessonProgress } = await supabase
        .from("micro_lesson_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed");

      setLessonsCompleted(lessonProgress?.length || 0);

      // Fetch usage data for study streak
      const { data: usage, error: usageError } = await supabase
        .from("daily_usage_summary")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true })
        .limit(7);

      if (usageError) throw usageError;

      // Generate study data
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const dayUsage = usage?.find((u) => u.date === dateStr);
        
        last7Days.push({
          date: date.toLocaleDateString("en-US", { weekday: "short" }),
          minutes: dayUsage ? Number(dayUsage.audio_minutes_used) : 0,
        });
      }

      setStudyData(last7Days);

      // Calculate streak
      let streak = 0;
      for (let i = last7Days.length - 1; i >= 0; i--) {
        if (last7Days[i].minutes > 0) streak++;
        else break;
      }
      setStreakDays(streak);

    } catch (error) {
      console.error("Error fetching progress data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-orange-500";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your progress...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          Your Progress
        </h2>
        <p className="text-muted-foreground">
          Track your learning journey and achievements
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{streakDays}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Award className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalBadges}</p>
                <p className="text-xs text-muted-foreground">Badges Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{lessonsCompleted}</p>
                <p className="text-xs text-muted-foreground">Lessons Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalDocuments}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Documents Progress */}
      {recentDocuments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Document Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.lastStudied
                      ? `Studied ${formatDistanceToNow(new Date(doc.lastStudied), { addSuffix: true })}`
                      : "Not studied yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {doc.score !== null ? (
                    <>
                      <div className={cn("w-2 h-2 rounded-full", getScoreColor(doc.score))} />
                      <span className="text-sm font-medium">{doc.score}%</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate?.("explain")}
                >
                  <Brain className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Study Streak Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Learning Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar 
                    dataKey="minutes" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Minutes"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Badges Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Badges Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {badgeStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={badgeStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="name"
                    >
                      {badgeStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>No badges earned yet</p>
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {badgeStats.map((stat) => (
                <div key={stat.name} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: stat.color }}
                  />
                  <span className="text-muted-foreground">{stat.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Mastery */}
      {subjectMastery.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Subject Mastery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subjectMastery.map((subject) => (
                <div key={subject.subject}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-foreground">{subject.subject}</span>
                    <span className="text-muted-foreground">{subject.mastery}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        subject.mastery >= 80
                          ? "bg-green-500"
                          : subject.mastery >= 60
                          ? "bg-yellow-500"
                          : "bg-orange-500"
                      )}
                      style={{ width: `${subject.mastery}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button variant="outline" onClick={() => onNavigate?.("lessons")} className="gap-2">
          <BookOpen className="h-4 w-4" />
          Start Micro-Lesson
        </Button>
        <Button variant="outline" onClick={() => onNavigate?.("badges")} className="gap-2">
          <Award className="h-4 w-4" />
          View All Badges
        </Button>
        <Button variant="outline" onClick={() => onNavigate?.("leaderboard")} className="gap-2">
          <TrendingUp className="h-4 w-4" />
          Check Leaderboard
        </Button>
      </div>
    </div>
  );
};

export default ProgressDashboard;
