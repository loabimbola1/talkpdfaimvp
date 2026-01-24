import { useState } from "react";
import { ChevronDown, ChevronUp, Bug, CheckCircle, AlertTriangle, XCircle, Volume2, FileType, Globe, Languages, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface TTSMetadata {
  tts_provider?: string;
  requested_language?: string;
  translation_applied?: boolean;
  failed_providers?: string[];
  tts_text_length?: number;
  tts_text_preview?: string;
  audio_size_bytes?: number;
  chunks_generated?: number;
  processed_at?: string;
  voice_used?: string;
  file_type?: string;
}

interface TTSDebugPanelProps {
  metadata?: TTSMetadata | null;
  className?: string;
  defaultOpen?: boolean;
}

const providerLabels: Record<string, string> = {
  yarngpt: "YarnGPT (Nigerian Native)",
  elevenlabs: "ElevenLabs",
  "openrouter-gemini": "OpenRouter Gemini",
  "lovable-gemini": "Lovable AI Gateway",
  none: "No Audio",
};

const languageLabels: Record<string, string> = {
  en: "English",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
  pcm: "Nigerian Pidgin",
};

const TTSDebugPanel = ({ metadata, className, defaultOpen = false }: TTSDebugPanelProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!metadata) {
    return null;
  }

  const isSuccess = metadata.tts_provider && metadata.tts_provider !== "none";
  const hasFallback = (metadata.failed_providers?.length || 0) > 0 && isSuccess;
  const isFailure = !isSuccess;

  const getStatusColor = () => {
    if (isFailure) return "text-destructive";
    if (hasFallback) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getStatusIcon = () => {
    if (isFailure) return <XCircle className="h-4 w-4" />;
    if (hasFallback) return <AlertTriangle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className="border-dashed border-muted-foreground/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">TTS Debug Info</CardTitle>
                <span className={cn("flex items-center gap-1", getStatusColor())}>
                  {getStatusIcon()}
                  <span className="text-xs">
                    {isFailure ? "Failed" : hasFallback ? "Fallback Used" : "Success"}
                  </span>
                </span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* Provider Status */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>TTS Provider</span>
                </div>
                <Badge variant={isSuccess ? "default" : "destructive"} className="font-medium">
                  {providerLabels[metadata.tts_provider || "none"] || metadata.tts_provider}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileType className="h-3.5 w-3.5" />
                  <span>Voice Used</span>
                </div>
                <span className="font-medium">{metadata.voice_used || "N/A"}</span>
              </div>
            </div>

            {/* Language Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Requested Language</span>
                </div>
                <span className="font-medium">
                  {languageLabels[metadata.requested_language || "en"] || metadata.requested_language}
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Languages className="h-3.5 w-3.5" />
                  <span>Translation</span>
                </div>
                <Badge variant={metadata.translation_applied ? "secondary" : "outline"}>
                  {metadata.translation_applied ? "Applied" : "Not Applied"}
                </Badge>
              </div>
            </div>

            {/* Audio Stats */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Audio Size</span>
                <p className="font-medium">{formatBytes(metadata.audio_size_bytes)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Text Length</span>
                <p className="font-medium">{metadata.tts_text_length?.toLocaleString() || "N/A"} chars</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Chunks</span>
                <p className="font-medium">{metadata.chunks_generated || 1}</p>
              </div>
            </div>

            {/* File Type */}
            {metadata.file_type && (
              <div className="text-sm">
                <span className="text-muted-foreground">Source File: </span>
                <Badge variant="outline" className="ml-1">
                  {metadata.file_type.toUpperCase()}
                </Badge>
              </div>
            )}

            {/* Text Preview */}
            {metadata.tts_text_preview && (
              <div className="text-sm">
                <span className="text-muted-foreground block mb-1">Text Preview:</span>
                <p className="text-xs bg-muted/50 rounded p-2 line-clamp-2 italic">
                  "{metadata.tts_text_preview}..."
                </p>
              </div>
            )}

            {/* Failed Providers */}
            {metadata.failed_providers && metadata.failed_providers.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground block mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                  Failed Providers:
                </span>
                <div className="flex flex-wrap gap-1">
                  {metadata.failed_providers.map((provider, idx) => (
                    <Badge key={idx} variant="destructive" className="text-xs">
                      {provider}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Processed At */}
            {metadata.processed_at && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Processed: {formatDate(metadata.processed_at)}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default TTSDebugPanel;
