import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  Play, 
  CheckCircle2, 
  Trophy,
  Loader2,
  RotateCcw,
  ChevronRight,
  BookOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MicroLesson {
  id: string;
  title: string;
  subject: string;
  duration: number; // in seconds (60s for micro-lessons)
  status: "new" | "in_progress" | "completed";
  documentId?: string;
  conceptIndex?: number;
  score?: number;
}

interface MicroLessonsProps {
  onLessonComplete?: (lessonId: string, score: number) => void;
}

const MicroLessons = ({ onLessonComplete }: MicroLessonsProps) => {
  const [lessons, setLessons] = useState<MicroLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<MicroLesson | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "completed">("all");

  useEffect(() => {
    fetchLessons();
  }, []);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      setIsRunning(false);
      handleLessonComplete();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeRemaining]);

  const fetchLessons = async () => {
    try {
      // Fetch documents with study_prompts to generate micro-lessons
      const { data: documents, error } = await supabase
        .from("documents")
        .select("id, title, study_prompts, status")
        .eq("status", "ready")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Generate micro-lessons from document concepts
      const generatedLessons: MicroLesson[] = [];
      
      documents?.forEach((doc) => {
        if (doc.study_prompts && Array.isArray(doc.study_prompts)) {
          const prompts = doc.study_prompts as Array<{ concept: string; prompt: string }>;
          prompts.slice(0, 3).forEach((prompt, index) => {
            generatedLessons.push({
              id: `${doc.id}-${index}`,
              title: prompt.concept || `Concept ${index + 1}`,
              subject: doc.title,
              duration: 60,
              status: "new",
              documentId: doc.id,
              conceptIndex: index,
            });
          });
        }
      });

      // Add some sample lessons if no documents exist
      if (generatedLessons.length === 0) {
        generatedLessons.push(
          {
            id: "sample-1",
            title: "What is Photosynthesis?",
            subject: "Biology",
            duration: 60,
            status: "completed",
            score: 95,
          },
          {
            id: "sample-2",
            title: "The Krebs Cycle Explained",
            subject: "Biology",
            duration: 60,
            status: "in_progress",
          },
          {
            id: "sample-3",
            title: "Understanding Chemical Bonds",
            subject: "Chemistry",
            duration: 60,
            status: "new",
          },
          {
            id: "sample-4",
            title: "Newton's Laws of Motion",
            subject: "Physics",
            duration: 60,
            status: "completed",
            score: 88,
          },
          {
            id: "sample-5",
            title: "Introduction to Derivatives",
            subject: "Calculus",
            duration: 60,
            status: "new",
          },
          {
            id: "sample-6",
            title: "Cell Membrane Structure",
            subject: "Biology",
            duration: 60,
            status: "completed",
            score: 92,
          }
        );
      }

      setLessons(generatedLessons);
    } catch (error) {
      console.error("Error fetching lessons:", error);
      toast.error("Failed to load lessons");
    } finally {
      setLoading(false);
    }
  };

  const startLesson = (lesson: MicroLesson) => {
    setActiveLesson(lesson);
    setTimeRemaining(60);
    setIsRunning(true);
    
    // Update lesson status
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lesson.id ? { ...l, status: "in_progress" as const } : l
      )
    );
  };

  const handleLessonComplete = () => {
    if (!activeLesson) return;
    
    const score = Math.floor(Math.random() * 20) + 80; // Random score 80-100 for demo
    
    setLessons((prev) =>
      prev.map((l) =>
        l.id === activeLesson.id
          ? { ...l, status: "completed" as const, score }
          : l
      )
    );
    
    toast.success(`Lesson completed! Score: ${score}%`);
    onLessonComplete?.(activeLesson.id, score);
    setActiveLesson(null);
  };

  const resetLesson = () => {
    setTimeRemaining(60);
    setIsRunning(false);
    setActiveLesson(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = (status: MicroLesson["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Play className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Clock className="h-3 w-3 mr-1" />
            New
          </Badge>
        );
    }
  };

  const filteredLessons = lessons.filter((lesson) => {
    if (filter === "all") return true;
    return lesson.status === filter;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading micro-lessons...</p>
      </div>
    );
  }

  // Active lesson view
  if (activeLesson) {
    const progress = ((60 - timeRemaining) / 60) * 100;
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            {activeLesson.title}
          </h2>
          <p className="text-muted-foreground">{activeLesson.subject}</p>
        </div>

        {/* Timer */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 56}
                strokeDashoffset={2 * Math.PI * 56 * (1 - progress / 100)}
                className="text-primary transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-foreground">
                {formatTime(timeRemaining)}
              </span>
              <span className="text-xs text-muted-foreground">remaining</span>
            </div>
          </div>

          <Progress value={progress} className="w-full max-w-md" />
        </div>

        {/* Lesson Content Placeholder */}
        <div className="bg-secondary/30 rounded-xl p-6 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Listen to the AI explanation and prepare to explain it back in your own words.
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={resetLesson}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleLessonComplete}>
            Complete Lesson
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          Micro-Lessons
        </h2>
        <p className="text-muted-foreground">
          60-second lessons designed for quick mastery
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 justify-center">
        {(["all", "new", "in_progress", "completed"] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
            className="capitalize"
          >
            {status === "in_progress" ? "In Progress" : status}
          </Button>
        ))}
      </div>

      {/* Lessons Grid */}
      {filteredLessons.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No lessons found in this category.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLessons.map((lesson) => (
            <div
              key={lesson.id}
              className={cn(
                "bg-card border border-border rounded-xl p-5 transition-all hover:shadow-card",
                lesson.status === "completed" && "border-primary/20"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                {getStatusBadge(lesson.status)}
                {lesson.status === "completed" && lesson.score && (
                  <div className="flex items-center gap-1">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                  </div>
                )}
              </div>

              <h3 className="font-semibold text-foreground mb-1">{lesson.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{lesson.subject}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>60s</span>
                </div>

                {lesson.status === "completed" ? (
                  <Button variant="outline" size="sm" onClick={() => startLesson(lesson)}>
                    Review
                  </Button>
                ) : lesson.status === "in_progress" ? (
                  <Button size="sm" onClick={() => startLesson(lesson)}>
                    Continue
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => startLesson(lesson)}>
                    Start
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MicroLessons;
