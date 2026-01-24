import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FileText, Headphones, Brain, AlertTriangle, Crown } from "lucide-react";
import { useUsageLimits } from "@/hooks/useUsageLimits";

interface UsageLimitsDisplayProps {
  onUpgrade?: () => void;
}

const UsageLimitsDisplay = ({ onUpgrade }: UsageLimitsDisplayProps) => {
  const { 
    plan, 
    limits, 
    loading, 
    usage,
    getPdfLimitDisplay,
  } = useUsageLimits();

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const isLimitReached = (used: number, limit: number) => {
    if (limit === -1) return false;
    return used >= limit;
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? "Unlimited" : limit.toString();
  };

  if (loading) {
    return null;
  }

  const pdfDisplay = getPdfLimitDisplay();
  
  const showWarning = 
    isLimitReached(pdfDisplay.used, pdfDisplay.limit) ||
    isLimitReached(usage.audio_minutes_used, limits.audio_minutes_per_day);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {plan === "free" ? "Daily Usage" : "Usage Limits"}
            </CardTitle>
            <CardDescription>
              {plan === "free" 
                ? "Your usage resets at midnight" 
                : "PDFs reset monthly, audio resets daily"}
            </CardDescription>
          </div>
          {plan !== "pro" && (
            <Button variant="outline" size="sm" className="gap-2" onClick={onUpgrade}>
              <Crown className="h-4 w-4" />
              Upgrade
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showWarning && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>You've reached some limits. Upgrade to continue.</span>
          </div>
        )}

        {/* PDFs Uploaded */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>PDFs Uploaded</span>
            </div>
            <span className="text-muted-foreground">
              {pdfDisplay.used} / {formatLimit(pdfDisplay.limit)}
              {pdfDisplay.limit !== -1 && (
                <span className="text-xs ml-1">
                  ({pdfDisplay.period === "day" ? "today" : "this month"})
                </span>
              )}
            </span>
          </div>
          {pdfDisplay.limit !== -1 && (
            <Progress 
              value={getUsagePercentage(pdfDisplay.used, pdfDisplay.limit)} 
              className={isLimitReached(pdfDisplay.used, pdfDisplay.limit) ? "[&>div]:bg-destructive" : ""}
            />
          )}
        </div>

        {/* Audio Minutes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-muted-foreground" />
              <span>Audio Minutes</span>
            </div>
            <span className="text-muted-foreground">
              {Math.round(usage.audio_minutes_used)} / {formatLimit(limits.audio_minutes_per_day)} min
              {limits.audio_minutes_per_day !== -1 && (
                <span className="text-xs ml-1">(today)</span>
              )}
            </span>
          </div>
          {limits.audio_minutes_per_day !== -1 && (
            <Progress 
              value={getUsagePercentage(usage.audio_minutes_used, limits.audio_minutes_per_day)} 
              className={isLimitReached(usage.audio_minutes_used, limits.audio_minutes_per_day) ? "[&>div]:bg-destructive" : ""}
            />
          )}
        </div>

        {/* Explain-Back (only show if available) */}
        {limits.explain_back_per_day !== 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <span>Explain-Back Sessions</span>
              </div>
              <span className="text-muted-foreground">
                {usage.explain_back_count} / {formatLimit(limits.explain_back_per_day)}
                {limits.explain_back_per_day !== -1 && (
                  <span className="text-xs ml-1">(today)</span>
                )}
              </span>
            </div>
            {limits.explain_back_per_day !== -1 && (
              <Progress 
                value={getUsagePercentage(usage.explain_back_count, limits.explain_back_per_day)} 
              />
            )}
          </div>
        )}

        {limits.explain_back_per_day === 0 && (
          <div className="text-sm text-muted-foreground text-center py-2">
            Explain-Back Mode is available on Plus and above
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UsageLimitsDisplay;
