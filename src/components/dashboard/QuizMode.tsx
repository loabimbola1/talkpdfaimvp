import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  CheckCircle,
  XCircle,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  BookOpen,
  Award,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id: string;
  type: "multiple-choice" | "true-false" | "fill-blanks" | "faq";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

interface Document {
  id: string;
  title: string;
  summary: string | null;
  study_prompts: unknown;
}

interface QuizModeProps {
  documentId?: string;
  onComplete?: (score: number, total: number) => void;
}

const QuizMode = ({ documentId: propDocumentId, onComplete }: QuizModeProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(propDocumentId || "");
  const [quizType, setQuizType] = useState<string>("mixed");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (propDocumentId && documents.length > 0) {
      setSelectedDocumentId(propDocumentId);
    }
  }, [propDocumentId, documents]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, summary, study_prompts")
        .eq("status", "ready")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const docsWithSummary = (data || []).filter((doc) => doc.summary);
      setDocuments(docsWithSummary);
      
      if (docsWithSummary.length > 0 && !propDocumentId) {
        setSelectedDocumentId(docsWithSummary[0].id);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuiz = async () => {
    const selectedDoc = documents.find((d) => d.id === selectedDocumentId);
    if (!selectedDoc?.summary) {
      toast.error("Please select a document with content first");
      return;
    }

    setIsGenerating(true);
    setQuestions([]);
    setUserAnswers({});
    setCurrentIndex(0);
    setShowResults(false);
    setSubmitted(false);

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          documentId: selectedDocumentId,
          documentSummary: selectedDoc.summary,
          studyPrompts: selectedDoc.study_prompts,
          quizType,
        },
      });

      if (error) throw error;

      if (data?.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        toast.success(`Quiz generated with ${data.questions.length} questions!`);
      } else {
        throw new Error("No questions generated");
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error("Failed to generate quiz. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const submitQuiz = async () => {
    setSubmitted(true);
    setShowResults(true);
    
    const score = questions.reduce((acc, q) => {
      const userAnswer = userAnswers[q.id]?.toLowerCase().trim();
      const correctAnswer = q.correctAnswer.toLowerCase().trim();
      return acc + (userAnswer === correctAnswer ? 1 : 0);
    }, 0);

    // Track usage and save quiz score
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Track usage
        await supabase.from("usage_tracking").insert({
          user_id: session.user.id,
          action_type: "quiz_complete",
          metadata: { 
            documentId: selectedDocumentId, 
            score, 
            total: questions.length,
            quizType 
          }
        });

        // Save quiz score for leaderboard
        await supabase.from("quiz_scores").insert({
          user_id: session.user.id,
          document_id: selectedDocumentId || null,
          score,
          total_questions: questions.length,
          quiz_type: quizType,
        });
      }
    } catch (error) {
      console.error("Error tracking usage:", error);
    }

    onComplete?.(score, questions.length);
    
    const percentage = Math.round((score / questions.length) * 100);
    if (percentage >= 80) {
      toast.success(`Excellent! You scored ${score}/${questions.length} (${percentage}%)! 🎉`);
    } else if (percentage >= 60) {
      toast.info(`Good job! You scored ${score}/${questions.length} (${percentage}%). Keep practicing!`);
    } else {
      toast.warning(`You scored ${score}/${questions.length} (${percentage}%). Review the explanations and try again!`);
    }
  };

  const resetQuiz = () => {
    setQuestions([]);
    setUserAnswers({});
    setCurrentIndex(0);
    setShowResults(false);
    setSubmitted(false);
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(userAnswers).length;
  const score = submitted
    ? questions.reduce((acc, q) => {
        const userAnswer = userAnswers[q.id]?.toLowerCase().trim();
        const correctAnswer = q.correctAnswer.toLowerCase().trim();
        return acc + (userAnswer === correctAnswer ? 1 : 0);
      }, 0)
    : 0;

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
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          No Documents Yet
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Upload and process a PDF first to generate quizzes.
        </p>
      </div>
    );
  }

  // Show quiz generation form
  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ListChecks className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            Quiz Mode
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Test your knowledge with AI-generated quizzes from your documents
          </p>
        </div>

        <div className="space-y-4 bg-secondary/30 rounded-xl p-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Select Document</Label>
            <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
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

          <div>
            <Label className="text-sm font-medium mb-2 block">Quiz Type</Label>
            <Select value={quizType} onValueChange={setQuizType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">Mixed (All Types)</SelectItem>
                <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                <SelectItem value="true-false">True or False</SelectItem>
                <SelectItem value="fill-blanks">Fill in the Blanks</SelectItem>
                <SelectItem value="faq">FAQ Style</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={generateQuiz}
          disabled={isGenerating || !selectedDocumentId}
          className="w-full gap-2"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Quiz...
            </>
          ) : (
            <>
              <HelpCircle className="h-5 w-5" />
              Generate Quiz
            </>
          )}
        </Button>
      </div>
    );
  }

  // Show results
  if (showResults) {
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
            percentage >= 80 ? "bg-green-100 dark:bg-green-900/30" : 
            percentage >= 60 ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-red-100 dark:bg-red-900/30"
          )}>
            <Award className={cn(
              "h-10 w-10",
              percentage >= 80 ? "text-green-600" : 
              percentage >= 60 ? "text-yellow-600" : "text-red-600"
            )} />
          </div>
          <h3 className="font-display text-2xl font-bold text-foreground mb-2">
            Quiz Complete!
          </h3>
          <p className={cn(
            "text-3xl font-bold mb-2",
            percentage >= 80 ? "text-green-600" : 
            percentage >= 60 ? "text-yellow-600" : "text-red-600"
          )}>
            {score}/{questions.length} ({percentage}%)
          </p>
          <Progress value={percentage} className="h-3 max-w-xs mx-auto" />
        </div>

        {/* Review answers */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {questions.map((q, idx) => {
            const userAnswer = userAnswers[q.id]?.toLowerCase().trim();
            const correctAnswer = q.correctAnswer.toLowerCase().trim();
            const isCorrect = userAnswer === correctAnswer;

            return (
              <div
                key={q.id}
                className={cn(
                  "p-4 rounded-xl border",
                  isCorrect 
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  {isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">
                      Q{idx + 1}: {q.question}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="text-muted-foreground">Your answer: </span>
                      <span className={isCorrect ? "text-green-600" : "text-red-600"}>
                        {userAnswers[q.id] || "(No answer)"}
                      </span>
                    </p>
                    {!isCorrect && (
                      <p className="text-sm text-green-600">
                        Correct: {q.correctAnswer}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {q.explanation}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button onClick={resetQuiz} variant="outline" className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            New Quiz
          </Button>
          <Button onClick={generateQuiz} className="flex-1 gap-2">
            <HelpCircle className="h-4 w-4" />
            Retry Same Topic
          </Button>
        </div>
      </div>
    );
  }

  // Active quiz
  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-muted-foreground">
            {answeredCount} answered
          </span>
        </div>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2" />
      </div>

      {/* Question Card */}
      <div className="bg-secondary/30 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            currentQuestion.difficulty === "easy" ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" :
            currentQuestion.difficulty === "medium" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400" :
            "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
          )}>
            {currentQuestion.difficulty}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {currentQuestion.type.replace("-", " ")}
          </span>
        </div>

        <h4 className="text-lg font-medium text-foreground mb-4">
          {currentQuestion.question}
        </h4>

        {/* Multiple Choice */}
        {currentQuestion.type === "multiple-choice" && currentQuestion.options && (
          <RadioGroup
            value={userAnswers[currentQuestion.id] || ""}
            onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
            className="space-y-3"
          >
            {currentQuestion.options.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-3 bg-background p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <RadioGroupItem value={option} id={`option-${idx}`} />
                <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer text-foreground">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {/* True/False */}
        {currentQuestion.type === "true-false" && (
          <RadioGroup
            value={userAnswers[currentQuestion.id] || ""}
            onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
            className="flex gap-4"
          >
            {["true", "false"].map((opt) => (
              <div key={opt} className="flex-1">
                <div className="flex items-center space-x-3 bg-background p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  <RadioGroupItem value={opt} id={`tf-${opt}`} />
                  <Label htmlFor={`tf-${opt}`} className="flex-1 cursor-pointer capitalize text-foreground">
                    {opt}
                  </Label>
                </div>
              </div>
            ))}
          </RadioGroup>
        )}

        {/* Fill in the Blanks */}
        {currentQuestion.type === "fill-blanks" && (
          <Input
            value={userAnswers[currentQuestion.id] || ""}
            onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
            placeholder="Type your answer..."
            className="text-lg"
          />
        )}

        {/* FAQ */}
        {currentQuestion.type === "faq" && (
          <Input
            value={userAnswers[currentQuestion.id] || ""}
            onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
            placeholder="Type your answer..."
            className="text-lg"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {currentIndex < questions.length - 1 ? (
          <Button
            onClick={() => setCurrentIndex((prev) => prev + 1)}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={submitQuiz}
            disabled={answeredCount < questions.length}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Submit Quiz
          </Button>
        )}
      </div>

      {/* Quick nav dots */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrentIndex(idx)}
            className={cn(
              "w-8 h-8 rounded-full text-xs font-medium transition-all",
              currentIndex === idx
                ? "bg-primary text-primary-foreground"
                : userAnswers[q.id]
                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            )}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuizMode;
