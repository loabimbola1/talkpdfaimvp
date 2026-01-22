import { useState } from "react";
import { useOfflineAudio } from "@/hooks/useOfflineAudio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Download, 
  Trash2, 
  Wifi, 
  WifiOff, 
  HardDrive, 
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const OfflineAudioManager = () => {
  const {
    cachedAudios,
    cacheSize,
    maxCacheSize,
    isDownloading,
    removeOfflineAudio,
    clearAllOfflineAudio,
  } = useOfflineAudio();
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [clearing, setClearing] = useState(false);

  // Listen for online/offline events
  useState(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const usagePercentage = (cacheSize / maxCacheSize) * 100;

  const handleClearAll = async () => {
    setClearing(true);
    await clearAllOfflineAudio();
    setClearing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
          isOnline ? "bg-primary/10" : "bg-amber-500/10"
        )}>
          {isOnline ? (
            <Wifi className="h-8 w-8 text-primary" />
          ) : (
            <WifiOff className="h-8 w-8 text-amber-500" />
          )}
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Offline Audio
        </h3>
        <p className="text-muted-foreground text-sm">
          {isOnline 
            ? "Download audio lessons for offline listening" 
            : "You're offline - play your cached audio"}
        </p>
      </div>

      {/* Storage Usage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Storage Usage</CardTitle>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatBytes(cacheSize)} / {formatBytes(maxCacheSize)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress 
            value={usagePercentage} 
            className={cn(
              usagePercentage > 80 && "[&>div]:bg-amber-500",
              usagePercentage > 95 && "[&>div]:bg-destructive"
            )}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {cachedAudios.length} audio file{cachedAudios.length !== 1 ? "s" : ""} saved for offline use
          </p>
        </CardContent>
      </Card>

      {/* Cached Audio List */}
      {cachedAudios.length === 0 ? (
        <div className="text-center py-8 bg-secondary/30 rounded-xl">
          <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="font-medium text-foreground mb-2">No Offline Audio</h4>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Download audio from your documents to listen offline. Look for the download icon in the Audio Player.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Saved Audio</h4>
            {cachedAudios.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Offline Audio?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {cachedAudios.length} cached audio files and free up {formatBytes(cacheSize)} of storage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleClearAll}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {clearing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Clear All"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="space-y-2">
            {cachedAudios.map((audio) => (
              <div
                key={audio.documentId}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate text-sm">
                      {audio.documentTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {audio.size ? formatBytes(audio.size) : "Unknown size"} • Saved {formatDate(audio.cachedAt)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOfflineAudio(audio.documentId)}
                  disabled={isDownloading === audio.documentId}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {isDownloading === audio.documentId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-secondary/30 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Tips for Offline Learning</p>
            <ul className="space-y-1">
              <li>• Download audio before going offline</li>
              <li>• Cached audio is stored in your browser</li>
              <li>• Clear browser data will remove offline files</li>
              <li>• Pro subscribers have unlimited downloads</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineAudioManager;
