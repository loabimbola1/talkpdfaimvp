import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Share } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { cn } from "@/lib/utils";

export const PwaInstallBanner = () => {
  const { isInstallable, isInstalled, showBanner, isIOS, promptInstall, dismissBanner } = usePwaInstall();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Delay showing banner for better UX
    if (showBanner && !isInstalled) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [showBanner, isInstalled]);

  // Auto-hide after 15 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        dismissBanner();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, dismissBanner]);

  if (!isVisible || isInstalled) return null;

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setIsVisible(false);
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm",
        "bg-card border border-border rounded-xl shadow-elevated p-4",
        "transform transition-all duration-300 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      )}
    >
      <button
        onClick={() => {
          setIsVisible(false);
          dismissBanner();
        }}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Download className="h-6 w-6 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm">
            Install TalkPDF AI
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isIOS 
              ? "Add to Home Screen for offline access"
              : "Install for faster access & offline mode"
            }
          </p>
          
          {isIOS ? (
            <div className="mt-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-1">
                Tap <Share className="h-3 w-3 inline" /> then "Add to Home Screen"
              </p>
            </div>
          ) : (
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleInstall}
                disabled={!isInstallable}
                className="text-xs h-8"
              >
                <Download className="h-3 w-3 mr-1" />
                Install
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  setIsVisible(false);
                  dismissBanner();
                }}
                className="text-xs h-8"
              >
                Maybe Later
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
