import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Play, Clock, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import AudioStatusIndicator, { getAudioStatus, AudioStatus } from "./AudioStatusIndicator";
import { useDocuments, Document } from "@/hooks/useDocuments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MyDocumentsProps {
  onSelectDocument: (documentId: string) => void;
}

const MyDocuments = ({ onSelectDocument }: MyDocumentsProps) => {
  const { documents, loading, refetch } = useDocuments();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  const handleAudioStatusChange = (docId: string, newStatus: AudioStatus) => {
    if (newStatus === "processing") {
      // Refetch documents after a delay to get updated status
      setTimeout(refetch, 3000);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;
    
    const id = documentToDelete.id;
    setDeletingId(id);
    setDocumentToDelete(null);
    
    try {
      // Use select to get a count of affected rows
      const { error, data } = await supabase
        .from("documents")
        .delete()
        .eq("id", id)
        .select("id");
      
      if (error) throw error;
      
      // Check if any rows were actually deleted
      if (!data || data.length === 0) {
        throw new Error("Document could not be deleted. Please try again.");
      }
      
      toast.success("Document permanently deleted");
      
      // Force refetch to ensure state is synced with database
      await refetch();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete document");
      // Refetch in case of error to ensure UI is in sync
      await refetch();
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      uploaded: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
      processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      ready: "bg-green-500/10 text-green-600 dark:text-green-400",
      error: "bg-red-500/10 text-red-600 dark:text-red-400",
    };
    return styles[status as keyof typeof styles] || styles.uploaded;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          No Documents Yet
        </h3>
        <p className="text-muted-foreground mb-6">
          Upload your first PDF to start learning!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Your Documents ({documents.length})
        </h3>
      </div>

      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-foreground truncate">
                  {doc.title}
                </h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                    doc.status
                  )}`}
                >
                  {doc.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(doc.created_at), {
                    addSuffix: true,
                  })}
                </span>
                {doc.audio_duration_seconds && (
                  <span>{formatDuration(doc.audio_duration_seconds)}</span>
                )}
                {doc.explain_back_score !== null && (
                  <span className="text-primary font-medium">
                    Score: {doc.explain_back_score}%
                  </span>
                )}
                <AudioStatusIndicator
                  documentId={doc.id}
                  status={getAudioStatus(doc)}
                  audioUrl={doc.audio_url}
                  audioLanguage={doc.audio_language}
                  onRetry={refetch}
                  onStatusChange={(status) => handleAudioStatusChange(doc.id, status)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {doc.status === "ready" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSelectDocument(doc.id)}
                  title="Play audio"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDocumentToDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete document"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{doc.title}"? This action cannot be undone. 
                      All associated audio and progress data will be permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDocumentToDelete(null)}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyDocuments;
