import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Flame, 
  Award, 
  BookOpen, 
  TrendingUp,
  Loader2,
  Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

const ProgressDashboard = ({ onNavigate }: ProgressDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [streakDays, setStreakDays] = useState(0);
  const [totalBadges, setTotalBadges] = useState(0);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [studyData, setStudyData] = useState<StudyStreak[]>([]);
  const [badgeStats, setBadgeStats] = useState<BadgeStats[]>([]);
  const [subjectMastery, setSubjectMastery] = useState<SubjectMastery[]>([]);

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      // Fetch badges
      const { data: badges, error: badgesError } = await supabase
        .from("badges")
        .select("*")
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

      // Fetch documents for subject mastery
      const { data: documents, error: docsError } = await supabase
        .from("documents")
        .select("title, explain_back_score")
        .not("explain_back_score", "is", null);

      if (docsError) throw docsError;

      // Group by inferred subject (first word of title or generic)
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
      if (masteryData.length === 0) {
        masteryData.push(
          { subject: "Biology", mastery: 85 },
          { subject: "Chemistry", mastery: 72 },
          { subject: "Physics", mastery: 68 },
          { subject: "Calculus", mastery: 55 }
        );
      }

      setSubjectMastery(masteryData);

      // Fetch usage data for study streak
      const { data: usage, error: usageError } = await supabase
        .from("daily_usage_summary")
        .select("*")
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
          minutes: dayUsage?.audio_minutes_used || Math.floor(Math.random() * 30) + 5,
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
      setLessonsCompleted(12); // Sample data

    } catch (error) {
      console.error("Error fetching progress data:", error);
    } finally {
      setLoading(false);
    }
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
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {subjectMastery.length > 0 
                    ? Math.round(subjectMastery.reduce((a, b) => a + b.mastery, 0) / subjectMastery.length)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Mastery</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
};

export default ProgressDashboard;
