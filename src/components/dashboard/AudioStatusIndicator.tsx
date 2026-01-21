import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Volume2, VolumeX, Loader2, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AudioStatus = "no-audio" | "queued" | "processing" | "ready" | "error";

interface AudioStatusIndicatorProps {
  documentId: string;
  status: AudioStatus;
  audioUrl: string | null;
  audioLanguage: string | null;
  onRetry?: () => void;
  onStatusChange?: (status: AudioStatus) => void;
  className?: string;
}

const statusConfig: Record<AudioStatus, {
  icon: typeof Volume2;
  label: string;
  tooltip: string;
  color: string;
}> = {
  "no-audio": {
    icon: VolumeX,
    label: "No Audio",
    tooltip: "No audio has been generated for this document yet. Click retry to generate.",
    color: "text-muted-foreground",
  },
  "queued": {
    icon: Clock,
    label: "Queued",
    tooltip: "Audio generation is queued and will start shortly.",
    color: "text-yellow-500",
  },
  "processing": {
    icon: Loader2,
    label: "Processing",
    tooltip: "Audio is currently being generated. This may take a few minutes.",
    color: "text-blue-500",
  },
  "ready": {
    icon: Volume2,
    label: "Ready",
    tooltip: "Audio is ready to play!",
    color: "text-green-500",
  },
  "error": {
    icon: AlertCircle,
    label: "Error",
    tooltip: "Audio generation failed. Click retry to try again.",
    color: "text-destructive",
  },
};

const AudioStatusIndicator = ({
  documentId,
  status,
  audioUrl,
  audioLanguage,
  onRetry,
  onStatusChange,
  className,
}: AudioStatusIndicatorProps) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const config = statusConfig[status];
  const Icon = config.icon;

  const handleRetry = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    onStatusChange?.("processing");

    try {
      const { error } = await supabase.functions.invoke("process-pdf", {
        body: {
          documentId,
          language: audioLanguage || "en",
          regenerateAudio: true,
        },
      });

      if (error) throw error;

      toast.success("Audio generation started! This may take a few minutes.");
      onRetry?.();
    } catch (err: any) {
      console.error("Retry error:", err);
      toast.error(`Failed to regenerate audio: ${err.message}`);
      onStatusChange?.("error");
    } finally {
      setIsRetrying(false);
    }
  };

  const showRetryButton = status === "no-audio" || status === "error";

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1.5", config.color)}>
              <Icon
                className={cn(
                  "h-4 w-4",
                  status === "processing" && "animate-spin"
                )}
              />
              <span className="text-xs font-medium">{config.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{config.tooltip}</p>
            {audioLanguage && status === "ready" && (
              <p className="text-xs text-muted-foreground mt-1">
                Language: {audioLanguage.toUpperCase()}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {showRetryButton && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Retry audio generation</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

export function getAudioStatus(doc: {
  audio_url: string | null;
  status: string;
}): AudioStatus {
  if (doc.audio_url) return "ready";
  if (doc.status === "processing") return "processing";
  if (doc.status === "error") return "error";
  if (doc.status === "uploaded") return "no-audio";
  return "no-audio";
}

export default AudioStatusIndicator;
