import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Crown, AlertTriangle, Lock, Volume2, Languages } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { useFeatureAccess, LANGUAGE_ACCESS } from "@/hooks/useFeatureAccess";
import { useAchievements } from "@/hooks/useAchievements";
import { useMilestoneNotifications } from "@/hooks/useMilestoneNotifications";

interface UploadedFile {
  id?: string;
  file: File;
  name: string;
  size: number;
  status: "uploading" | "complete" | "processing" | "error";
  progress: number;
}

const languages = [
  { value: "en", label: "English (Nigerian Accent)", planRequired: "free" as const },
  { value: "yo", label: "Yoruba", planRequired: "plus" as const },
  { value: "ig", label: "Igbo", planRequired: "plus" as const },
  { value: "pcm", label: "Pidgin", planRequired: "plus" as const },
  { value: "ha", label: "Hausa", planRequired: "pro" as const },
];

interface PDFUploadProps {
  onDocumentProcessed?: (documentId: string) => void;
  onUpgrade?: () => void;
}

const PDFUpload = ({ onDocumentProcessed, onUpgrade }: PDFUploadProps) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [hasConfirmedLanguage, setHasConfirmedLanguage] = useState(false);
  
  const { 
    plan, 
    limits, 
    usage, 
    loading: usageLoading, 
    canUploadPdf, 
    getRemainingPdfs,
    getPdfLimitDisplay,
    refetch: refetchUsage 
  } = useUsageLimits();

  const { canAccessLanguage, getLanguageUpgradeMessage } = useFeatureAccess();
  const { checkAndCelebrate } = useAchievements();
  const { checkNearMilestones } = useMilestoneNotifications();

  // Sanitize filename to remove special characters that cause storage issues
  const sanitizeFileName = (name: string): string => {
    return name
      .replace(/[–—]/g, '-')  // Replace em-dash and en-dash with hyphen
      .replace(/[^\w\s.-]/g, '') // Remove other special characters
      .replace(/\s+/g, '_')     // Replace spaces with underscores
      .substring(0, 100);        // Limit length
  };

  const handleLanguageSelect = (value: string) => {
    if (canAccessLanguage(value)) {
      setSelectedLanguage(value);
    } else {
      toast.error(getLanguageUpgradeMessage(value), {
        action: onUpgrade ? {
          label: "Upgrade",
          onClick: onUpgrade,
        } : undefined,
      });
    }
  };

  const confirmLanguageSelection = () => {
    if (!selectedLanguage) {
      toast.error("Please select an audio language first");
      return;
    }
    setHasConfirmedLanguage(true);
    toast.success(`Audio language set to ${languages.find(l => l.value === selectedLanguage)?.label}`);
  };

  const changeLanguage = () => {
    setHasConfirmedLanguage(false);
  };

  // Capture selected language at function creation time to avoid stale closures
  const uploadFileWithLanguage = useCallback(async (file: File, language: string) => {
    const sanitizedName = sanitizeFileName(file.name);
    const newFile: UploadedFile = {
      file,
      name: file.name,
      size: file.size,
      status: "uploading",
      progress: 0,
    };

    setFiles((prev) => [...prev, newFile]);
    setIsUploading(true);

    let createdDocumentId: string | undefined;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Create document record with audio_language pre-set
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          title: file.name.replace(".pdf", ""),
          file_name: sanitizedName,
          file_size: file.size,
          audio_language: language, // Store selected language immediately
        })
        .select()
        .single();

      if (docError) throw docError;
      createdDocumentId = document.id;

      const filePath = `${user.id}/${document.id}/${sanitizedName}`;

      const { error: uploadError } = await supabase.storage.from("talkpdf").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

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

      setIsProcessing(true);
      try {
        console.log(`Processing PDF with language: ${language}`);
        const { data, error } = await supabase.functions.invoke("process-pdf", {
          body: {
            documentId: document.id,
            language: language, // Use the captured language parameter
          }
        });

        if (error) throw error;

        toast.success(`${file.name} processed successfully!`);
        
        await checkAndCelebrate("first_pdf");
        await checkAndCelebrate("pdf_5");
        await checkAndCelebrate("pdf_10");
        await checkAndCelebrate("pdf_25");
        await checkAndCelebrate("pdf_50");
        await checkNearMilestones("documents");
        
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
  }, [checkAndCelebrate, checkNearMilestones, onDocumentProcessed]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Capture the current language value immediately
    const currentLanguage = selectedLanguage;
    console.log(`onDrop called with language: ${currentLanguage}`);
    
    // Check usage limits before allowing upload
    if (!canUploadPdf()) {
      const limitMsg = plan === "free" 
        ? `Daily PDF limit reached (${limits.pdfs_per_day} PDFs).`
        : `Monthly PDF limit reached.`;
      toast.error(
        `${limitMsg} Upgrade your plan to upload more.`,
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
      const timeFrame = plan === "free" ? "today" : "this month";
      toast.warning(`You can only upload ${remaining} more PDF(s) ${timeFrame}.`);
      acceptedFiles = acceptedFiles.slice(0, remaining);
    }

    acceptedFiles.forEach((file) => {
      const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!validTypes.includes(file.type)) {
        toast.error("Only PDF and Word (.docx) files are allowed");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size must be less than 20MB");
        return;
      }
      // Pass the captured language explicitly
      uploadFileWithLanguage(file, currentLanguage);
    });
  }, [canUploadPdf, getRemainingPdfs, limits.pdfs_per_day, onUpgrade, plan, selectedLanguage, uploadFileWithLanguage]);

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
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 20 * 1024 * 1024,
    multiple: true,
    disabled: !hasConfirmedLanguage,
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

    // Capture language at the start of processing
    const processingLanguage = selectedLanguage;
    console.log(`Processing PDFs with language: ${processingLanguage}`);

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
            language: processingLanguage
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
              {plan === "free" 
                ? `You've reached your daily limit of ${limits.pdfs_per_day} PDFs.`
                : plan === "plus"
                  ? `You've reached your monthly limit of ${limits.pdfs_per_month} PDFs.`
                  : "Upload limit reached."
              }
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
      {!usageLoading && canUpload && remainingPdfs !== Infinity && (() => {
        const pdfDisplay = getPdfLimitDisplay();
        const timeFrame = pdfDisplay.period === "day" ? "today" : "this month";
        return (
          <div className="text-sm text-muted-foreground text-center">
            <span className="font-medium text-foreground">{remainingPdfs}</span> PDF upload{remainingPdfs !== 1 ? "s" : ""} remaining {timeFrame}
          </div>
        );
      })()}

      {/* Step-by-Step Language Selection */}
      {!hasConfirmedLanguage ? (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border-2 border-primary/20">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Languages className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground mb-2">
              Step 1: Select Your Audio Language
            </h3>
            <p className="text-muted-foreground text-sm">
              Choose the language for your document's audio before uploading
            </p>
          </div>

          <div className="max-w-sm mx-auto space-y-4">
            <Select value={selectedLanguage} onValueChange={handleLanguageSelect}>
              <SelectTrigger className="w-full h-12 text-base">
                <SelectValue placeholder="Select audio language..." />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => {
                  const hasAccess = canAccessLanguage(lang.value);
                  return (
                    <SelectItem 
                      key={lang.value} 
                      value={lang.value}
                      disabled={!hasAccess}
                      className={cn(!hasAccess && "opacity-60")}
                    >
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4" />
                        <span>{lang.label}</span>
                        {!hasAccess && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                        {lang.planRequired === "pro" && !hasAccess && (
                          <span className="text-xs text-muted-foreground">(Pro)</span>
                        )}
                        {lang.planRequired === "plus" && !hasAccess && (
                          <span className="text-xs text-muted-foreground">(Plus+)</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {selectedLanguage && (
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  <Volume2 className="h-4 w-4 inline mr-1" />
                  Your document will be converted to{" "}
                  <span className="font-medium text-foreground">
                    {languages.find(l => l.value === selectedLanguage)?.label}
                  </span>{" "}
                  audio with Nigerian accent
                </p>
              </div>
            )}

            <Button 
              onClick={confirmLanguageSelection}
              disabled={!selectedLanguage}
              className="w-full h-12"
              size="lg"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Confirm & Continue to Upload
            </Button>
          </div>

          {plan !== "pro" && (
            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground mb-2">
                Want more languages? Upgrade your plan for access to all 5 Nigerian languages.
              </p>
              {onUpgrade && (
                <Button variant="ghost" size="sm" onClick={onUpgrade} className="gap-1">
                  <Crown className="h-3 w-3" />
                  View Plans
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Language Selection Confirmed Banner */}
          <div className="flex items-center justify-between bg-primary/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Volume2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Audio Language: {languages.find(l => l.value === selectedLanguage)?.label}
                </p>
                <p className="text-xs text-muted-foreground">Step 2: Upload your document below</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={changeLanguage}>
              Change
            </Button>
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
                      ? "Drop your document here" 
                      : "Drag & drop your PDF or Word document here"}
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
        </>
      )}

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
