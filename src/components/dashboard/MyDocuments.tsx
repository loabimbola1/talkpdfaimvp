import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Play, Clock, Trash2, Loader2, WifiOff, Download, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import AudioStatusIndicator, { getAudioStatus, AudioStatus } from "./AudioStatusIndicator";
import { useDocuments, Document } from "@/hooks/useDocuments";
import { useOfflineAudio } from "@/hooks/useOfflineAudio";
import { useOfflinePdf } from "@/hooks/useOfflinePdf";
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

// Skeleton component for loading state
const DocumentSkeleton = () => (
  <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl">
    <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Skeleton className="h-8 w-8 rounded-md" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  </div>
);

const MyDocuments = ({ onSelectDocument }: MyDocumentsProps) => {
  const { documents, loading, refetch, isOnline, error } = useDocuments();
  const { removeOfflineAudio, isAudioCached, downloadForOffline: downloadAudioForOffline } = useOfflineAudio();
  const { removeOfflinePdf, isPdfCached, downloadPdfForOffline } = useOfflinePdf();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const handleAudioStatusChange = (docId: string, newStatus: AudioStatus) => {
    if (newStatus === "processing") {
      setTimeout(refetch, 3000);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    const doc = documentToDelete;
    const id = doc.id;
    setDeletingId(id);
    setDocumentToDelete(null);

    try {
      // Verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to delete documents");
        return;
      }

      // Delete from database with explicit user_id check
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      // Delete associated files from storage
      if (doc.file_url) {
        await supabase.storage.from("talkpdf").remove([doc.file_url]);
      }
      if (doc.audio_url) {
        await supabase.storage.from("talkpdf").remove([doc.audio_url]);
      }

      // Clear offline cache
      await removeOfflineAudio(id);
      await removeOfflinePdf(id);

      toast.success("Document permanently deleted");
      await refetch();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete document");
      await refetch();
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(documents.map((d) => d.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setBulkDeleting(true);
    setShowBulkDeleteDialog(false);
    const idsToDelete = Array.from(selectedIds);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to delete documents");
        return;
      }

      // Get documents to delete for storage cleanup
      const docsToDelete = documents.filter((d) => idsToDelete.includes(d.id));

      // Delete from database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .in("id", idsToDelete)
        .eq("user_id", user.id);

      if (dbError) throw dbError;

      // Delete associated files from storage
      const filesToRemove: string[] = [];
      for (const doc of docsToDelete) {
        if (doc.file_url) filesToRemove.push(doc.file_url);
        if (doc.audio_url) filesToRemove.push(doc.audio_url);
      }

      if (filesToRemove.length > 0) {
        await supabase.storage.from("talkpdf").remove(filesToRemove);
      }

      // Clear offline caches
      for (const docId of idsToDelete) {
        await removeOfflineAudio(docId);
        await removeOfflinePdf(docId);
      }

      toast.success(`${idsToDelete.length} document${idsToDelete.length > 1 ? "s" : ""} deleted`);
      clearSelection();
      await refetch();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Failed to delete some documents");
      await refetch();
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDownloadForOffline = async (doc: Document) => {
    const promises: Promise<boolean>[] = [];

    // Download audio if available
    if (doc.audio_url && !isAudioCached(doc.id)) {
      promises.push(downloadAudioForOffline(doc.id, doc.title, doc.audio_url));
    }

    // Download PDF if available
    if (doc.file_url && !isPdfCached(doc.id)) {
      promises.push(downloadPdfForOffline(doc.id, doc.title, doc.file_url));
    }

    if (promises.length === 0) {
      toast.info("Document is already available offline");
      return;
    }

    await Promise.all(promises);
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

  const isDocumentOffline = (doc: Document) => {
    return isAudioCached(doc.id) || isPdfCached(doc.id);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <DocumentSkeleton key={i} />
          ))}
        </div>
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
      {/* Header with offline indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Your Documents ({documents.length})
          </h3>
          {!isOnline && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
              <WifiOff className="h-3 w-3" />
              Offline
            </span>
          )}
          {error && isOnline && (
            <span className="text-xs text-muted-foreground">{error}</span>
          )}
        </div>

        {/* Selection controls */}
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Cancel
              </Button>
              {selectedIds.size > 0 && (
                <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={bulkDeleting}
                    >
                      {bulkDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete ({selectedIds.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selectedIds.size} Documents</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedIds.size} document{selectedIds.size > 1 ? "s" : ""}? 
                        This action cannot be undone. All associated audio files, PDFs, and offline data will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectMode(true)}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Select
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`flex items-center gap-4 p-4 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors ${
              selectedIds.has(doc.id) ? "ring-2 ring-primary" : ""
            }`}
          >
            {/* Selection checkbox */}
            {selectMode && (
              <Checkbox
                checked={selectedIds.has(doc.id)}
                onCheckedChange={() => toggleSelect(doc.id)}
                className="flex-shrink-0"
              />
            )}

            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 relative">
              <FileText className="h-6 w-6 text-primary" />
              {isDocumentOffline(doc) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <Download className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
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
              {/* Download for offline button */}
              {doc.status === "ready" && !selectMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownloadForOffline(doc)}
                  title="Download for offline"
                  disabled={!isOnline}
                  className={isDocumentOffline(doc) ? "text-primary" : "text-muted-foreground"}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}

              {doc.status === "ready" && !selectMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSelectDocument(doc.id)}
                  title="Play audio"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}

              {!selectMode && (
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
                        All associated audio, PDF files, and offline data will be permanently removed.
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
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyDocuments;
