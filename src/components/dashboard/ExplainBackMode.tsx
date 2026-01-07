import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mic, 
  MicOff, 
  Send, 
  Loader2, 
  Brain, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Volume2,
  FileText,
  Lightbulb,
  Award,
  Share2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface StudyPrompt {
  topic: string;
  prompt: string;
}

interface Document {
  id: string;
  title: string;
  study_prompts: StudyPrompt[] | null;
  summary: string | null;
}

type RawDocument = {
  id: string;
  title: string;
  study_prompts: unknown;
  summary: string | null;
}

interface ExplainBackModeProps {
  documentId?: string;
  documentTitle?: string;
  onBadgeEarned?: () => void;
}

interface EvaluationResult {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface Badge {
  badge_type: string;
  badge_name: string;
  description: string;
}

const ExplainBackMode = ({ documentId: propDocumentId, documentTitle, onBadgeEarned }: ExplainBackModeProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(propDocumentId || "");
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [earnedBadge, setEarnedBadge] = useState<Badge | null>(null);
  const [completedPrompts, setCompletedPrompts] = useState<number>(0);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Fetch user's documents with study prompts
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Handle propDocumentId changes
  useEffect(() => {
    if (propDocumentId && documents.length > 0) {
      setSelectedDocumentId(propDocumentId);
      setCurrentPromptIndex(0);
      resetExercise();
    }
  }, [propDocumentId, documents]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, study_prompts, summary")
        .eq("status", "ready")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const docsWithPrompts: Document[] = ((data || []) as RawDocument[])
        .filter((doc) => {
          const prompts = doc.study_prompts;
          return prompts && Array.isArray(prompts) && prompts.length > 0;
        })
        .map((doc) => ({
          id: doc.id,
          title: doc.title,
          summary: doc.summary,
          study_prompts: doc.study_prompts as StudyPrompt[]
        }));
      
      setDocuments(docsWithPrompts);
      
      if (docsWithPrompts.length > 0 && !propDocumentId) {
        setSelectedDocumentId(docsWithPrompts[0].id);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDocument = documents.find((d) => d.id === selectedDocumentId);
  const studyPrompts = (selectedDocument?.study_prompts as StudyPrompt[]) || [];
  const currentPrompt = studyPrompts[currentPromptIndex];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        
        // Transcribe the audio
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started. Explain the concept in your own words.");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Could not access microphone. Please check permissions or type your explanation instead.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      const { data, error } = await supabase.functions.invoke("voice-to-text", {
        body: { audio: base64Audio }
      });

      if (error) throw error;

      if (data?.text) {
        setExplanation((prev) => prev ? `${prev} ${data.text}` : data.text);
        toast.success("Voice transcribed successfully!");
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe. Please type your explanation instead.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const awardBadge = async (score: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine badge based on score
      let badgeType: string | null = null;
      let badgeName = "";
      let description = "";

      // Check if this is first explanation
      const { count } = await supabase
        .from("badges")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (count === 0) {
        badgeType = "first_concept";
        badgeName = "First Concept Mastered";
        description = "Completed your first Explain-Back exercise!";
      } else if (score === 100) {
        badgeType = "perfect_score";
        badgeName = "Perfect Score";
        description = "Achieved a flawless 100% on a concept!";
      } else if (score >= 90) {
        badgeType = "master_explainer";
        badgeName = "Master Explainer";
        description = `Scored ${score}% - Excellent understanding!`;
      } else if (score >= 80) {
        badgeType = "quick_learner";
        badgeName = "Quick Learner";
        description = `Scored ${score}% - Great job!`;
      } else if (score >= 70) {
        badgeType = "rising_star";
        badgeName = "Rising Star";
        description = `Scored ${score}% - Keep improving!`;
      }

      if (badgeType) {
        const { error } = await supabase.from("badges").insert({
          user_id: user.id,
          badge_type: badgeType,
          badge_name: badgeName,
          description,
          document_id: selectedDocumentId,
          score,
        });

        if (!error) {
          setEarnedBadge({ badge_type: badgeType, badge_name: badgeName, description });
          onBadgeEarned?.();
          toast.success(`🎉 Badge earned: ${badgeName}!`);
        }
      }
    } catch (error) {
      console.error("Error awarding badge:", error);
    }
  };

  const evaluateExplanation = async () => {
    if (!explanation.trim()) {
      toast.error("Please provide an explanation first");
      return;
    }

    if (!currentPrompt) {
      toast.error("No concept to evaluate against");
      return;
    }

    setIsEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke("explain-back-evaluate", {
        body: {
          concept: currentPrompt.prompt,
          explanation: explanation.trim(),
          documentId: selectedDocumentId,
          documentSummary: selectedDocument?.summary
        }
      });

      if (error) throw error;

      setResult(data);
      setCompletedPrompts((prev) => prev + 1);
      
      // Award badge based on score
      await awardBadge(data.score);
      
      // Track usage
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("usage_tracking").insert({
          user_id: session.user.id,
          action_type: "explain_back",
          metadata: { documentId: selectedDocumentId, score: data.score }
        });

        // Update document's explain_back_score
        await supabase
          .from("documents")
          .update({ 
            explain_back_score: data.score,
            last_studied_at: new Date().toISOString()
          })
          .eq("id", selectedDocumentId);
      }
    } catch (error) {
      console.error("Error evaluating explanation:", error);
      toast.error("Failed to evaluate. Please try again.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const resetExercise = () => {
    setExplanation("");
    setResult(null);
    setShowHint(false);
    setEarnedBadge(null);
  };

  const nextPrompt = () => {
    if (currentPromptIndex < studyPrompts.length - 1) {
      setCurrentPromptIndex((prev) => prev + 1);
    } else {
      setCurrentPromptIndex(0);
      toast.success("You've reviewed all concepts! Starting from the beginning.");
    }
    resetExercise();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent!";
    if (score >= 80) return "Great job!";
    if (score >= 70) return "Good understanding";
    if (score >= 60) return "Keep practicing";
    return "Needs improvement";
  };

  // Generate hint from summary
  const getHint = () => {
    if (!selectedDocument?.summary || !currentPrompt) return null;
    const summaryWords = selectedDocument.summary.split(" ").slice(0, 30).join(" ");
    return `💡 Hint: Think about ${currentPrompt.topic.toLowerCase()}. Here's a clue from the document: "${summaryWords}..."`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your documents...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          No Documents Yet
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Upload and process a PDF first to generate study prompts. The AI will create questions based on your document content.
        </p>
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
          Explain-Back Mode
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Test your understanding by explaining concepts in your own words. Earn badges for great explanations!
        </p>
      </div>

      {/* Document Selection */}
      <div className="bg-secondary/30 rounded-xl p-4">
        <label className="text-sm font-medium text-foreground mb-2 block">Select Document:</label>
        <Select value={selectedDocumentId} onValueChange={(value) => {
          setSelectedDocumentId(value);
          setCurrentPromptIndex(0);
          resetExercise();
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a document" />
          </SelectTrigger>
          <SelectContent>
            {documents.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!result ? (
        <>
          {/* Concept to Explain */}
          {currentPrompt && (
            <div className="bg-secondary/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Volume2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-muted-foreground">
                      Concept {currentPromptIndex + 1} of {studyPrompts.length}:
                    </p>
                    {studyPrompts.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={nextPrompt}>
                        Skip
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-primary font-medium mb-1">{currentPrompt.topic}</p>
                  <p className="font-medium text-foreground">{currentPrompt.prompt}</p>
                  
                  {/* Hint Section */}
                  <div className="mt-3">
                    {!showHint ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowHint(true)}
                        className="gap-1 text-muted-foreground hover:text-primary"
                      >
                        <Lightbulb className="h-4 w-4" />
                        Need a hint?
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/20">
                        {getHint()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recording / Text Input */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                className="gap-2"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Transcribing...
                  </>
                ) : isRecording ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    Record Explanation
                  </>
                )}
              </Button>
            </div>

            {isRecording && (
              <div className="flex items-center justify-center gap-2 text-destructive">
                <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm">Recording... Speak clearly</span>
              </div>
            )}

            <div className="relative">
              <p className="text-sm text-muted-foreground mb-2">Or type your explanation:</p>
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain the concept in your own words..."
                rows={6}
                className="resize-none"
              />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                {explanation.length} characters
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={evaluateExplanation}
            disabled={isEvaluating || !explanation.trim() || !currentPrompt}
            className="w-full gap-2"
            size="lg"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Submit Explanation
              </>
            )}
          </Button>
        </>
      ) : (
        /* Results */
        <div className="space-y-6">
          {/* Badge Earned */}
          {earnedBadge && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center animate-in fade-in slide-in-from-bottom-4">
              <Award className="h-10 w-10 text-primary mx-auto mb-2" />
              <p className="font-bold text-primary text-lg">{earnedBadge.badge_name}</p>
              <p className="text-sm text-muted-foreground">{earnedBadge.description}</p>
            </div>
          )}

          {/* Score */}
          <div className="text-center">
            <div className={cn("text-5xl font-bold mb-2", getScoreColor(result.score))}>
              {result.score}%
            </div>
            <p className={cn("font-medium", getScoreColor(result.score))}>
              {getScoreLabel(result.score)}
            </p>
            <Progress value={result.score} className="mt-4 h-3" />
          </div>

          {/* Feedback */}
          <div className="bg-secondary/30 rounded-xl p-4">
            <p className="text-foreground">{result.feedback}</p>
          </div>

          {/* Strengths */}
          {result.strengths.length > 0 && (
            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                What you did well:
              </h4>
              <ul className="space-y-2">
                {result.strengths.map((strength, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {result.improvements.length > 0 && (
            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-yellow-500" />
                Areas to improve:
              </h4>
              <ul className="space-y-2">
                {result.improvements.map((improvement, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={resetExercise} variant="outline" className="flex-1 gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            {studyPrompts.length > 1 && (
              <Button onClick={nextPrompt} className="flex-1 gap-2">
                Next Concept
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplainBackMode;
