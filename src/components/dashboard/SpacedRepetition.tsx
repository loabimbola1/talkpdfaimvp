import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Brain,
  Clock,
  Flame,
  Target,
  RefreshCw,
  ChevronRight,
  Loader2,
  Bell,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isToday, isTomorrow, isPast, addDays, format } from "date-fns";

interface SpacedRepetitionItem {
  id: string;
  document_id: string;
  concept_index: number;
  concept_title: string;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  last_review_date: string | null;
  next_review_date: string;
  last_score: number | null;
  document_title?: string;
}

interface SpacedRepetitionProps {
  onStartReview?: (documentId: string, conceptIndex: number) => void;
}

// SM-2 Algorithm implementation
const calculateNextReview = (
  quality: number, // 0-5 scale where 0=complete blackout, 5=perfect response
  repetitions: number,
  easinessFactor: number,
  intervalDays: number
): { newInterval: number; newEF: number; newReps: number } => {
  let newEF = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  let newInterval: number;
  let newReps: number;

  if (quality < 3) {
    // Failed - reset
    newReps = 0;
    newInterval = 1;
  } else {
    newReps = repetitions + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(intervalDays * newEF);
    }
  }

  return { newInterval, newEF, newReps };
};

const SpacedRepetition = ({ onStartReview }: SpacedRepetitionProps) => {
  const [items, setItems] = useState<SpacedRepetitionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueToday, setDueToday] = useState<SpacedRepetitionItem[]>([]);
  const [upcoming, setUpcoming] = useState<SpacedRepetitionItem[]>([]);
  const [mastered, setMastered] = useState<SpacedRepetitionItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchSpacedRepetitionData();
  }, []);

  const fetchSpacedRepetitionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch spaced repetition items
      const { data: srData, error: srError } = await supabase
        .from("spaced_repetition")
        .select("*")
        .eq("user_id", user.id)
        .order("next_review_date", { ascending: true });

      if (srError) throw srError;

      // Get document titles
      const documentIds = [...new Set(srData?.map((item) => item.document_id) || [])];
      
      let documentsMap: Record<string, string> = {};
      if (documentIds.length > 0) {
        const { data: documents } = await supabase
          .from("documents")
          .select("id, title")
          .in("id", documentIds);

        documentsMap = (documents || []).reduce((acc, doc) => {
          acc[doc.id] = doc.title;
          return acc;
        }, {} as Record<string, string>);
      }

      const enrichedItems: SpacedRepetitionItem[] = (srData || []).map((item) => ({
        ...item,
        document_title: documentsMap[item.document_id] || "Unknown Document",
      }));

      setItems(enrichedItems);

      // Categorize items
      const now = new Date();
      const due: SpacedRepetitionItem[] = [];
      const future: SpacedRepetitionItem[] = [];
      const done: SpacedRepetitionItem[] = [];

      enrichedItems.forEach((item) => {
        const reviewDate = new Date(item.next_review_date);
        if (isPast(reviewDate) || isToday(reviewDate)) {
          due.push(item);
        } else if (item.repetitions >= 5 && item.last_score && item.last_score >= 80) {
          done.push(item);
        } else {
          future.push(item);
        }
      });

      setDueToday(due);
      setUpcoming(future.slice(0, 10));
      setMastered(done);
    } catch (error) {
      console.error("Error fetching spaced repetition data:", error);
      toast.error("Failed to load review schedule");
    } finally {
      setLoading(false);
    }
  };

  // Sync documents with spaced repetition
  const syncWithDocuments = async () => {
    setSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get documents with study prompts
      const { data: documents, error: docError } = await supabase
        .from("documents")
        .select("id, title, study_prompts")
        .eq("status", "ready")
        .not("study_prompts", "is", null);

      if (docError) throw docError;

      // Get existing SR items
      const { data: existingSR } = await supabase
        .from("spaced_repetition")
        .select("document_id, concept_index")
        .eq("user_id", user.id);

      const existingSet = new Set(
        (existingSR || []).map((sr) => `${sr.document_id}-${sr.concept_index}`)
      );

      // Create new SR items for missing concepts
      const newItems: Array<{
        user_id: string;
        document_id: string;
        concept_index: number;
        concept_title: string;
      }> = [];

      (documents || []).forEach((doc) => {
        const prompts = doc.study_prompts as Array<{ topic: string; prompt: string }> | null;
        if (prompts && Array.isArray(prompts)) {
          prompts.forEach((prompt, index) => {
            const key = `${doc.id}-${index}`;
            if (!existingSet.has(key)) {
              newItems.push({
                user_id: user.id,
                document_id: doc.id,
                concept_index: index,
                concept_title: prompt.topic || `Concept ${index + 1}`,
              });
            }
          });
        }
      });

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from("spaced_repetition")
          .insert(newItems);

        if (insertError) throw insertError;
        toast.success(`Added ${newItems.length} new concepts to your review schedule!`);
      } else {
        toast.info("All concepts are already synced!");
      }

      await fetchSpacedRepetitionData();
    } catch (error) {
      console.error("Error syncing documents:", error);
      toast.error("Failed to sync documents");
    } finally {
      setSyncing(false);
    }
  };

  const updateAfterReview = async (itemId: string, score: number) => {
    try {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      // Convert 0-100 score to 0-5 quality
      const quality = Math.round((score / 100) * 5);

      const { newInterval, newEF, newReps } = calculateNextReview(
        quality,
        item.repetitions,
        Number(item.easiness_factor),
        item.interval_days
      );

      const nextReviewDate = addDays(new Date(), newInterval);

      const { error } = await supabase
        .from("spaced_repetition")
        .update({
          easiness_factor: newEF,
          interval_days: newInterval,
          repetitions: newReps,
          last_review_date: new Date().toISOString(),
          next_review_date: nextReviewDate.toISOString(),
          last_score: score,
        })
        .eq("id", itemId);

      if (error) throw error;

      toast.success(`Next review in ${newInterval} day${newInterval > 1 ? "s" : ""}!`);
      await fetchSpacedRepetitionData();
    } catch (error) {
      console.error("Error updating review:", error);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getIntervalLabel = (days: number) => {
    if (days === 1) return "Daily";
    if (days <= 7) return `${days} days`;
    if (days <= 30) return `${Math.round(days / 7)} weeks`;
    return `${Math.round(days / 30)} months`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your review schedule...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Spaced Repetition
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Review concepts at optimal intervals for long-term retention
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center mx-auto mb-2">
              <Bell className="h-5 w-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{dueToday.length}</p>
            <p className="text-xs text-muted-foreground">Due Today</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{upcoming.length}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{mastered.length}</p>
            <p className="text-xs text-muted-foreground">Mastered</p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={syncWithDocuments} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync with Documents
        </Button>
      </div>

      {/* Due Today */}
      {dueToday.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Due for Review ({dueToday.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueToday.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.concept_title}</p>
                  <p className="text-xs text-muted-foreground">{item.document_title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {getIntervalLabel(item.interval_days)}
                    </Badge>
                    {item.last_score && (
                      <span className={cn("text-xs font-medium", getScoreColor(item.last_score))}>
                        Last: {item.last_score}%
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onStartReview?.(item.document_id, item.concept_index)}
                  className="gap-1"
                >
                  Review
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Reviews */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Upcoming Reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.concept_title}</p>
                  <p className="text-xs text-muted-foreground">{item.document_title}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {isToday(new Date(item.next_review_date))
                      ? "Today"
                      : isTomorrow(new Date(item.next_review_date))
                      ? "Tomorrow"
                      : format(new Date(item.next_review_date), "MMM d")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.repetitions} reviews
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Mastered Concepts */}
      {mastered.length > 0 && (
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              Mastered Concepts ({mastered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {mastered.slice(0, 10).map((item) => (
                <Badge key={item.id} variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {item.concept_title}
                </Badge>
              ))}
              {mastered.length > 10 && (
                <Badge variant="secondary">+{mastered.length - 10} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && (
        <div className="text-center py-8 bg-secondary/30 rounded-xl">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No concepts scheduled for review yet.</p>
          <p className="text-sm text-muted-foreground mb-4">
            Upload documents and complete Explain-Back exercises to build your review schedule.
          </p>
          <Button onClick={syncWithDocuments} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Documents
          </Button>
        </div>
      )}
    </div>
  );
};

export default SpacedRepetition;
