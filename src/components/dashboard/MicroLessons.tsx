import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock, 
  Play, 
  Pause,
  CheckCircle2, 
  Trophy,
  Loader2,
  RotateCcw,
  ChevronRight,
  BookOpen,
  Volume2,
  VolumeX,
  Sparkles,
  Languages,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface MicroLesson {
  id: string;
  title: string;
  subject: string;
  duration: number;
  status: "new" | "in_progress" | "completed";
  documentId?: string;
  conceptIndex?: number;
  score?: number;
  aiExplanation?: string;
  audioUrl?: string;
}

interface MicroLessonsProps {
  onLessonComplete?: (lessonId: string, score: number) => void;
}

const languages = [
  { value: "en", label: "English (Nigerian)" },
  { value: "yo", label: "Yoruba" },
  { value: "ig", label: "Igbo" },
  { value: "pcm", label: "Pidgin" },
  { value: "ha", label: "Hausa" },
];

const MicroLessons = ({ onLessonComplete }: MicroLessonsProps) => {
  const [lessons, setLessons] = useState<MicroLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<MicroLesson | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "completed">("all");
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [explanation, setExplanation] = useState<string>("");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  const { canAccessLanguage } = useFeatureAccess();

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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
      }
    };
  }, [audioElement]);

  const fetchLessons = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch documents with study_prompts
      const { data: documents, error } = await supabase
        .from("documents")
        .select("id, title, study_prompts, summary, status")
        .eq("status", "ready")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch existing lesson progress
      const { data: progress } = await supabase
        .from("micro_lesson_progress")
        .select("*")
        .eq("user_id", user.id);

      const progressMap = new Map(
        (progress || []).map((p) => [`${p.document_id}-${p.concept_index}`, p])
      );

      // Generate micro-lessons from document concepts
      const generatedLessons: MicroLesson[] = [];
      
      documents?.forEach((doc) => {
        if (doc.study_prompts && Array.isArray(doc.study_prompts)) {
          const prompts = doc.study_prompts as Array<{ topic?: string; concept?: string; prompt: string }>;
          prompts.slice(0, 3).forEach((prompt, index) => {
            const lessonId = `${doc.id}-${index}`;
            const existingProgress = progressMap.get(lessonId);
            
            generatedLessons.push({
              id: lessonId,
              title: prompt.topic || prompt.concept || `Concept ${index + 1}`,
              subject: doc.title,
              duration: 60,
              status: existingProgress?.status as "new" | "in_progress" | "completed" || "new",
              documentId: doc.id,
              conceptIndex: index,
              score: existingProgress?.score || undefined,
              aiExplanation: existingProgress?.ai_explanation || undefined,
              audioUrl: existingProgress?.audio_url || undefined,
            });
          });
        }
      });

      // If no lessons, show demo lessons
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

  // Updated to accept pre-created audio element for browser autoplay policy compliance
  const generateAIExplanation = async (lesson: MicroLesson, preCreatedAudio?: HTMLAudioElement) => {
    setGeneratingExplanation(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson-audio", {
        body: {
          concept: lesson.title,
          language: selectedLanguage,
        },
      });

      if (error) throw error;

      setExplanation(data.explanation || "");
      
      // Save to database
      if (lesson.documentId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("micro_lesson_progress").upsert({
            user_id: user.id,
            document_id: lesson.documentId,
            concept_index: lesson.conceptIndex || 0,
            status: "in_progress",
            ai_explanation: data.explanation,
            audio_url: data.audioBase64 ? `data:audio/wav;base64,${data.audioBase64}` : null,
          }, { onConflict: "user_id,document_id,concept_index" });
        }
      }

      // If audio was generated and we have a pre-created audio element, use it
      if (data.audioBase64 && preCreatedAudio) {
        // Use WAV format since Gemini TTS now returns proper WAV with header
        const audioUrl = `data:audio/wav;base64,${data.audioBase64}`;
        preCreatedAudio.src = audioUrl;
        preCreatedAudio.onended = () => setIsPlayingAudio(false);
        preCreatedAudio.onerror = (e) => {
          console.error("Audio playback error:", e);
          setIsPlayingAudio(false);
          toast.error("Failed to play audio");
        };
        
        try {
          await preCreatedAudio.play();
          setIsPlayingAudio(true);
        } catch (playError) {
          console.warn("Auto-play failed:", playError);
          // User can still click play manually
        }
      }

      return data.explanation;
    } catch (error) {
      console.error("Error generating explanation:", error);
      // Fallback to a generic explanation
      const fallback = `Let's learn about ${lesson.title}. This concept is fundamental to understanding ${lesson.subject}. Take your time to absorb this information and try to explain it back in your own words.`;
      setExplanation(fallback);
      return fallback;
    } finally {
      setGeneratingExplanation(false);
    }
  };

  const playGeneratedAudio = (audioUrl: string) => {
    if (audioElement) {
      audioElement.pause();
    }

    const audio = new Audio(audioUrl);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => {
      setIsPlayingAudio(false);
      toast.error("Failed to play audio");
    };

    setAudioElement(audio);
    audio.play();
    setIsPlayingAudio(true);
  };

  const toggleAudio = () => {
    if (!audioElement) return;

    if (isPlayingAudio) {
      audioElement.pause();
      setIsPlayingAudio(false);
    } else {
      audioElement.play();
      setIsPlayingAudio(true);
    }
  };

  const startLesson = async (lesson: MicroLesson) => {
    setActiveLesson(lesson);
    setTimeRemaining(60);
    setExplanation("");
    
    // CRITICAL: Create Audio element IMMEDIATELY within user gesture context
    // This allows autoplay to work in browsers that require user interaction
    const audio = new Audio();
    audio.preload = "auto";
    setAudioElement(audio);
    
    // Update lesson status
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lesson.id ? { ...l, status: "in_progress" as const } : l
      )
    );

    // Generate AI explanation with audio - pass pre-created audio element
    await generateAIExplanation(lesson, audio);
    
    // Auto-start timer
    setIsRunning(true);
  };

  const handleLessonComplete = async () => {
    if (!activeLesson) return;
    
    // Stop audio
    if (audioElement) {
      audioElement.pause();
      setIsPlayingAudio(false);
    }
    
    const score = Math.floor(Math.random() * 20) + 80; // Random score 80-100 for demo
    
    setLessons((prev) =>
      prev.map((l) =>
        l.id === activeLesson.id
          ? { ...l, status: "completed" as const, score }
          : l
      )
    );

    // Save completion to database
    if (activeLesson.documentId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("micro_lesson_progress").upsert({
          user_id: user.id,
          document_id: activeLesson.documentId,
          concept_index: activeLesson.conceptIndex || 0,
          status: "completed",
          score,
          completed_at: new Date().toISOString(),
        }, { onConflict: "user_id,document_id,concept_index" });
      }
    }
    
    toast.success(`Lesson completed! Score: ${score}%`);
    onLessonComplete?.(activeLesson.id, score);
    setActiveLesson(null);
    setExplanation("");
  };

  const resetLesson = () => {
    if (audioElement) {
      audioElement.pause();
      setIsPlayingAudio(false);
    }
    setTimeRemaining(60);
    setIsRunning(false);
    setActiveLesson(null);
    setExplanation("");
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

        {/* AI Explanation */}
        <div className="bg-secondary/30 rounded-xl p-6">
          {generatingExplanation ? (
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-muted-foreground">AI is generating your Nigerian-accented audio explanation...</span>
            </div>
          ) : explanation ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">AI Explanation</span>
                  <Badge variant="outline" className="text-xs">
                    {languages.find(l => l.value === selectedLanguage)?.label}
                  </Badge>
                </div>
                {audioElement && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAudio}
                    className="gap-1"
                  >
                    {isPlayingAudio ? (
                      <>
                        <VolumeX className="h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4" />
                        Play Audio
                      </>
                    )}
                  </Button>
                )}
              </div>
              <p className="text-foreground leading-relaxed">{explanation}</p>
            </div>
          ) : (
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Listen to the AI explanation and prepare to explain it back in your own words.
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={resetLesson}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button 
            variant={isRunning ? "secondary" : "default"} 
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isRunning ? "Pause" : "Resume"}
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
          1-Minute Mastery
        </h2>
        <p className="text-muted-foreground">
          60-second micro-lessons with Nigerian-accented AI audio
        </p>
      </div>

      {/* Language Selection */}
      <div className="flex items-center justify-center gap-3">
        <Languages className="h-5 w-5 text-muted-foreground" />
        <Select 
          value={selectedLanguage} 
          onValueChange={(val) => {
            if (canAccessLanguage(val)) {
              setSelectedLanguage(val);
            } else {
              toast.error("Upgrade to access this language");
            }
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem 
                key={lang.value} 
                value={lang.value}
                disabled={!canAccessLanguage(lang.value)}
              >
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    <span className="text-sm font-medium">{lesson.score}%</span>
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
