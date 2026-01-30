import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Loader2, 
  Brain, 
  Volume2, 
  MessageCircle,
  BookOpen,
  Send,
  Lightbulb
} from "lucide-react";

const MAX_SUPPORT_MESSAGE_CHARS = 4000;
function clampSupportMessage(text: string) {
  if (text.length <= MAX_SUPPORT_MESSAGE_CHARS) return text;
  // Keep safely under the backend check (message.length > 4000)
  return text.slice(0, MAX_SUPPORT_MESSAGE_CHARS - 3) + "...";
}

interface Document {
  id: string;
  title: string;
  file_name: string;
  summary: string | null;
  study_prompts: { title: string; content: string }[] | null;
  audio_url: string | null;
}

interface DocumentReaderProps {
  documentId?: string;
  onNavigateToExplainBack?: (documentId: string, conceptIndex: number) => void;
  onNavigateToListen?: (documentId: string) => void;
}

const DocumentReader = ({ 
  documentId, 
  onNavigateToExplainBack,
  onNavigateToListen 
}: DocumentReaderProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [currentConceptIndex, setCurrentConceptIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [questionAnswer, setQuestionAnswer] = useState<string>("");

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (documentId && documents.length > 0) {
      const doc = documents.find(d => d.id === documentId);
      if (doc) {
        setSelectedDoc(doc);
        setCurrentConceptIndex(0);
        setExplanation("");
        setQuestionAnswer("");
      }
    }
  }, [documentId, documents]);

  const fetchDocuments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("documents")
        .select("id, title, file_name, summary, study_prompts, audio_url")
        .eq("user_id", session.user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Type assertion for study_prompts
      const typedData = (data || []).map(doc => ({
        ...doc,
        study_prompts: doc.study_prompts as { title: string; content: string }[] | null
      }));

      setDocuments(typedData);
      
      // Auto-select first document if none selected
      if (typedData.length > 0 && !documentId) {
        setSelectedDoc(typedData[0]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentChange = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      setSelectedDoc(doc);
      setCurrentConceptIndex(0);
      setExplanation("");
      setQuestionAnswer("");
    }
  };

  const handleExplainConcept = async () => {
    if (!selectedDoc || !selectedDoc.study_prompts) return;

    const currentConcept = selectedDoc.study_prompts[currentConceptIndex];
    if (!currentConcept) return;

    setExplaining(true);
    setExplanation("");

    try {
      const rawMessage = `As a Nigerian academic tutor, please explain this concept in simple terms that a secondary school or university student would understand. Use local examples where possible:\n\nTopic: ${currentConcept.title}\n\nContent: ${currentConcept.content}`;
      const { data, error } = await supabase.functions.invoke("support-chatbot", {
        body: {
          message: clampSupportMessage(rawMessage),
          conversationHistory: []
        }
      });

      if (error) throw error;

      setExplanation(data.response || "I couldn't generate an explanation. Please try again.");
    } catch (error) {
      console.error("Error getting explanation:", error);
      toast.error("Failed to get explanation");
      setExplanation("Sorry, I couldn't explain this concept right now. Please try again later.");
    } finally {
      setExplaining(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !selectedDoc) return;

    const currentConcept = selectedDoc.study_prompts?.[currentConceptIndex];
    
    setAskingQuestion(true);
    setQuestionAnswer("");

    try {
      const contextMessage = currentConcept 
        ? `Context - Document: "${selectedDoc.title}", Current Topic: "${currentConcept.title}"\n\nTopic Content: ${currentConcept.content}\n\nStudent's Question: ${question}`
        : `Context - Document: "${selectedDoc.title}"\n\nDocument Summary: ${selectedDoc.summary || "No summary available"}\n\nStudent's Question: ${question}`;

      const { data, error } = await supabase.functions.invoke("support-chatbot", {
        body: {
          message: clampSupportMessage(contextMessage),
          conversationHistory: []
        }
      });

      if (error) throw error;

      setQuestionAnswer(data.response || "I couldn't answer your question. Please try again.");
      setQuestion("");
    } catch (error) {
      console.error("Error asking question:", error);
      toast.error("Failed to get answer");
    } finally {
      setAskingQuestion(false);
    }
  };

  const navigateConcept = (direction: "prev" | "next") => {
    if (!selectedDoc?.study_prompts) return;

    const newIndex = direction === "next" 
      ? Math.min(currentConceptIndex + 1, selectedDoc.study_prompts.length - 1)
      : Math.max(currentConceptIndex - 1, 0);
    
    setCurrentConceptIndex(newIndex);
    setExplanation("");
    setQuestionAnswer("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Documents Yet</h3>
        <p className="text-muted-foreground mb-4">
          Upload a PDF to start learning with the Document Reader.
        </p>
      </div>
    );
  }

  const currentConcept = selectedDoc?.study_prompts?.[currentConceptIndex];
  const totalConcepts = selectedDoc?.study_prompts?.length || 0;

  return (
    <div className="space-y-6">
      {/* Document Selector */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-md">
          <Select 
            value={selectedDoc?.id || ""} 
            onValueChange={handleDocumentChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a document to read" />
            </SelectTrigger>
            <SelectContent>
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span className="truncate">{doc.title}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedDoc?.audio_url && onNavigateToListen && (
          <Button 
            variant="outline" 
            onClick={() => onNavigateToListen(selectedDoc.id)}
            className="gap-2"
          >
            <Volume2 className="h-4 w-4" />
            Listen to Audio
          </Button>
        )}
      </div>

      {selectedDoc && (
        <>
          {/* Concept Navigation */}
          {totalConcepts > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Concept {currentConceptIndex + 1} of {totalConcepts}
                    </Badge>
                    <CardTitle className="text-lg">{currentConcept?.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateConcept("prev")}
                      disabled={currentConceptIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateConcept("next")}
                      disabled={currentConceptIndex >= totalConcepts - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 rounded-lg bg-secondary/30 p-4">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {currentConcept?.content || "No content available for this concept."}
                  </p>
                </ScrollArea>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button 
                    onClick={handleExplainConcept}
                    disabled={explaining}
                    className="gap-2"
                  >
                    {explaining ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lightbulb className="h-4 w-4" />
                    )}
                    Explain This
                  </Button>

                  {onNavigateToExplainBack && (
                    <Button 
                      variant="secondary"
                      onClick={() => onNavigateToExplainBack(selectedDoc.id, currentConceptIndex)}
                      className="gap-2"
                    >
                      <Brain className="h-4 w-4" />
                      Test My Understanding
                    </Button>
                  )}
                </div>

                {/* AI Explanation */}
                {explanation && (
                  <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">AI Explanation</span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {explanation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Document Summary (if no concepts) */}
          {totalConcepts === 0 && selectedDoc.summary && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 rounded-lg bg-secondary/30 p-4">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedDoc.summary}
                  </p>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Ask a Question */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5" />
                Ask a Question
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Type your question about this topic..."
                  className="min-h-[80px] resize-none"
                  disabled={askingQuestion}
                />
                <Button 
                  onClick={handleAskQuestion}
                  disabled={!question.trim() || askingQuestion}
                  size="icon"
                  className="h-auto"
                >
                  {askingQuestion ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Question Answer */}
              {questionAnswer && (
                <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Answer</span>
                  </div>
                  <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {questionAnswer}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DocumentReader;
