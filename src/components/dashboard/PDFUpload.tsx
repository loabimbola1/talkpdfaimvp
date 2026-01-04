import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

const PDFUpload = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  const uploadFile = async (file: File) => {
    const newFile: UploadedFile = {
      file,
      name: file.name,
      size: file.size,
      status: "uploading",
      progress: 0,
    };

    setFiles((prev) => [...prev, newFile]);
    setIsUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Create document record first
      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          title: file.name.replace(".pdf", ""),
          file_name: file.name,
          file_size: file.size,
          status: "uploading"
        })
        .select()
        .single();

      if (docError) throw docError;

      // Upload file to storage
      const filePath = `${user.id}/${document.id}/${file.name}`;
      
      const { error: uploadError } = await supabase
        .storage
        .from("talkpdf")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Update document with file URL
      await supabase
        .from("documents")
        .update({ 
          file_url: filePath,
          status: "uploaded"
        })
        .eq("id", document.id);

      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, id: document.id, progress: 100, status: "complete" as const }
            : f
        )
      );

      toast.success(`${file.name} uploaded successfully`);
    } catch (error: any) {
      console.error("Upload error:", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, status: "error" as const }
            : f
        )
      );
      toast.error(`Failed to upload ${file.name}: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
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
  }, []);

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
    
    if (files.length === completedFiles.length) {
      toast.success("All documents processed! Check 'My Documents' to view them.");
    }
  };

  const hasCompletedFiles = files.some((f) => f.status === "complete");

  return (
    <div className="space-y-6">
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
          "border-2 border-dashed rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-secondary/30"
        )}
      >
        <input {...getInputProps()} />
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
              {isDragActive ? "Drop your PDF here" : "Drag & drop your PDF here"}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse (max 20MB)
            </p>
          </div>
          <Button variant="outline" size="sm" type="button">
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

      {/* Actions */}
      {hasCompletedFiles && (
        <div className="flex justify-end">
          <Button 
            className="gap-2" 
            onClick={processPDFs}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Process PDFs
                <FileText className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PDFUpload;
