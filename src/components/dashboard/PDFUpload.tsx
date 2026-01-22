import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Crown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUsageLimits } from "@/hooks/useUsageLimits";

interface UploadedFile {
  id?: string;
  file: File;
  name: string;
  size: number;
  status: "uploading" | "complete" | "processing" | "error";
  progress: number;
}

const languages = [
  { value: "en", label: "English" },
  { value: "yo", label: "Yoruba" },
  { value: "ha", label: "Hausa" },
  { value: "ig", label: "Igbo" },
  { value: "pcm", label: "Pidgin" },
];

interface PDFUploadProps {
  onDocumentProcessed?: (documentId: string) => void;
  onUpgrade?: () => void;
}

const PDFUpload = ({ onDocumentProcessed, onUpgrade }: PDFUploadProps) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  
  const { 
    plan, 
    limits, 
    usage, 
    loading: usageLoading, 
    canUploadPdf, 
    getRemainingPdfs,
    refetch: refetchUsage 
  } = useUsageLimits();

  // Sanitize filename to remove special characters that cause storage issues
  const sanitizeFileName = (name: string): string => {
    return name
      .replace(/[–—]/g, '-')  // Replace em-dash and en-dash with hyphen
      .replace(/[^\w\s.-]/g, '') // Remove other special characters
      .replace(/\s+/g, '_')     // Replace spaces with underscores
      .substring(0, 100);        // Limit length
  };

  const uploadFile = async (file: File) => {
    const sanitizedName = sanitizeFileName(file.name);
    const newFile: UploadedFile = {
      file,
      name: file.name,  // Keep original name for display
      size: file.size,
      status: "uploading",
      progress: 0,
    };

    setFiles((prev) => [...prev, newFile]);
    setIsUploading(true);

    let createdDocumentId: string | undefined;

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Create document record first (status defaults to 'uploaded' in DB)
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          title: file.name.replace(".pdf", ""),  // Keep original title for display
          file_name: sanitizedName,  // Use sanitized name for storage
          file_size: file.size,
        })
        .select()
        .single();

      if (docError) throw docError;
      createdDocumentId = document.id;

      // Upload file to storage with sanitized filename
      const filePath = `${user.id}/${document.id}/${sanitizedName}`;

      const { error: uploadError } = await supabase.storage.from("talkpdf").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      // Update document with file URL
      await supabase
        .from("documents")
        .update({
          file_url: filePath,
          status: "uploaded",
        })
        .eq("id", document.id);

      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, id: document.id, progress: 100, status: "processing" as const }
            : f
        )
      );

      toast.success(`${file.name} uploaded. Starting processing...`);

      // Auto-process the PDF immediately after upload
      setIsProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke("process-pdf", {
          body: {
            documentId: document.id,
            language: selectedLanguage
          }
        });

        if (error) throw error;

        toast.success(`${file.name} processed successfully!`);
        
        // Remove from list and notify parent
        setFiles((prev) => prev.filter((f) => f.name !== file.name));
        onDocumentProcessed?.(document.id);
      } catch (processError: any) {
        console.error("Processing error:", processError);
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "error" as const } : f
          )
        );
        toast.error(`Failed to process ${file.name}: ${processError.message}`);
      } finally {
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error("Upload error:", error);

      if (createdDocumentId) {
        await supabase.from("documents").update({ status: "error" }).eq("id", createdDocumentId);
      }

      setFiles((prev) =>
        prev.map((f) => (f.name === file.name ? { ...f, status: "error" as const } : f))
      );
      toast.error(`Failed to upload ${file.name}: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Check usage limits before allowing upload
    if (!canUploadPdf()) {
      toast.error(
        `Daily PDF limit reached (${limits.pdfs_per_day} PDFs). Upgrade your plan to upload more.`,
        {
          action: onUpgrade ? {
            label: "Upgrade",
            onClick: onUpgrade,
          } : undefined,
        }
      );
      return;
    }

    const remaining = getRemainingPdfs();
    if (acceptedFiles.length > remaining && remaining !== Infinity) {
      toast.warning(`You can only upload ${remaining} more PDF(s) today.`);
      acceptedFiles = acceptedFiles.slice(0, remaining);
    }

    acceptedFiles.forEach((file) => {
      if (file.type !== "application/pdf") {
        toast.error("Only PDF files are allowed");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size must be less than 20MB");
        return;
      }
      uploadFile(file);
    });
  }, [canUploadPdf, getRemainingPdfs, limits.pdfs_per_day, onUpgrade]);

  // Refetch usage after processing completes
  useEffect(() => {
    if (!isProcessing && files.length === 0) {
      refetchUsage();
    }
  }, [isProcessing, files.length, refetchUsage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxSize: 20 * 1024 * 1024,
    multiple: true,
  });

  const removeFile = async (fileName: string, fileId?: string) => {
    if (fileId) {
      try {
        await supabase.from("documents").delete().eq("id", fileId);
      } catch (error) {
        console.error("Failed to delete document:", error);
      }
    }
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processPDFs = async () => {
    const completedFiles = files.filter((f) => f.status === "complete" && f.id);
    
    if (completedFiles.length === 0) {
      toast.error("No files to process");
      return;
    }

    setIsProcessing(true);
    let lastProcessedId: string | null = null;

    for (const file of completedFiles) {
      try {
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "processing" as const } : f
          )
        );

        const { data, error } = await supabase.functions.invoke("process-pdf", {
          body: {
            documentId: file.id,
            language: selectedLanguage
          }
        });

        if (error) throw error;

        toast.success(`${file.name} processed successfully!`);
        lastProcessedId = file.id!;
        
        // Remove from list after successful processing
        setFiles((prev) => prev.filter((f) => f.name !== file.name));
      } catch (error: any) {
        console.error("Processing error:", error);
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "error" as const } : f
          )
        );
        toast.error(`Failed to process ${file.name}: ${error.message}`);
      }
    }

    setIsProcessing(false);
    
    // Notify parent of the last processed document
    if (lastProcessedId && onDocumentProcessed) {
      onDocumentProcessed(lastProcessedId);
    }
  };

  const hasCompletedFiles = files.some((f) => f.status === "complete");

  const remainingPdfs = getRemainingPdfs();
  const canUpload = canUploadPdf();

  return (
    <div className="space-y-6">
      {/* Usage Limit Warning */}
      {!usageLoading && !canUpload && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-yellow-700 dark:text-yellow-400">
              You've reached your daily limit of {limits.pdfs_per_day} PDFs. 
              {plan === "free" && " Upgrade to upload more."}
            </span>
            {plan !== "pro" && onUpgrade && (
              <Button size="sm" variant="outline" className="ml-4 gap-1" onClick={onUpgrade}>
                <Crown className="h-3 w-3" />
                Upgrade
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Remaining uploads indicator */}
      {!usageLoading && canUpload && remainingPdfs !== Infinity && (
        <div className="text-sm text-muted-foreground text-center">
          <span className="font-medium text-foreground">{remainingPdfs}</span> PDF upload{remainingPdfs !== 1 ? "s" : ""} remaining today
        </div>
      )}

      {/* Language Selection */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-foreground">Audio Language:</label>
        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-all duration-200",
          !canUpload && "opacity-50 pointer-events-none",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-secondary/30",
          canUpload && "cursor-pointer"
        )}
      >
        <input {...getInputProps()} disabled={!canUpload} />
        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              isDragActive ? "bg-primary/20" : "bg-secondary"
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8 transition-colors",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">
              {!canUpload 
                ? "Daily limit reached" 
                : isDragActive 
                  ? "Drop your PDF here" 
                  : "Drag & drop your PDF here"}
            </p>
            <p className="text-sm text-muted-foreground">
              {canUpload ? "or click to browse (max 20MB)" : "Upgrade to continue uploading"}
            </p>
          </div>
          <Button variant="outline" size="sm" type="button" disabled={!canUpload}>
            Browse Files
          </Button>
        </div>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">Uploaded Files</h3>
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2">
                    {file.status === "complete" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {file.status === "processing" && (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    )}
                    {file.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <button
                      onClick={() => removeFile(file.name, file.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      disabled={file.status === "processing"}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress
                    value={file.status === "processing" ? 50 : file.progress}
                    className="h-1.5 flex-1"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {file.status === "uploading"
                      ? `${Math.round(file.progress)}%`
                      : file.status === "processing"
                      ? "Processing..."
                      : formatFileSize(file.size)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 p-4 bg-primary/10 rounded-xl">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <span className="text-sm font-medium text-primary">Processing PDF automatically...</span>
        </div>
      )}
    </div>
  );
};

export default PDFUpload;
