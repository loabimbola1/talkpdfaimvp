import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  Mic, 
  MicOff, 
  Send, 
  Loader2, 
  Brain, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Volume2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ExplainBackModeProps {
  documentId?: string;
  documentTitle?: string;
}

const ExplainBackMode = ({ documentId, documentTitle }: ExplainBackModeProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  } | null>(null);
  const [concept, setConcept] = useState("What is photosynthesis and why is it important?");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Here you would transcribe the audio using a speech-to-text service
        // For now, we'll just indicate recording completed
        toast.success("Recording saved. Type your explanation below or edit the transcription.");
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started. Explain the concept in your own words.");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Could not access microphone. Please type your explanation instead.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const evaluateExplanation = async () => {
    if (!explanation.trim()) {
      toast.error("Please provide an explanation first");
      return;
    }

    setIsEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke("explain-back-evaluate", {
        body: {
          concept,
          explanation: explanation.trim(),
          documentId
        }
      });

      if (error) throw error;

      setResult(data);
      
      // Track usage
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("usage_tracking").insert({
          user_id: session.user.id,
          action_type: "explain_back",
          metadata: { documentId, score: data.score }
        });
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
          Test your understanding by explaining concepts in your own words. The AI will evaluate your explanation.
        </p>
      </div>

      {!result ? (
        <>
          {/* Concept to Explain */}
          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Volume2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Explain this concept:</p>
                <p className="font-medium text-foreground">{concept}</p>
              </div>
            </div>
          </div>

          {/* Recording / Text Input */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                className="gap-2"
              >
                {isRecording ? (
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
                <span className="text-sm">Recording...</span>
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
            disabled={isEvaluating || !explanation.trim()}
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

          {/* Try Again */}
          <Button onClick={resetExercise} variant="outline" className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Another Concept
          </Button>
        </div>
      )}
    </div>
  );
};

export default ExplainBackMode;
