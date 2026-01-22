import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Crown, Sparkles } from "lucide-react";
import { useFeatureAccess, PlanFeatures } from "@/hooks/useFeatureAccess";

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  onUpgrade?: () => void;
  showUpgradePrompt?: boolean;
  featureName?: string;
}

const FeatureGate = ({
  feature,
  children,
  fallback,
  onUpgrade,
  showUpgradePrompt = true,
  featureName,
}: FeatureGateProps) => {
  const { hasFeature, getUpgradeMessage, plan } = useFeatureAccess();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const displayName = featureName || String(feature).replace(/([A-Z])/g, " $1").toLowerCase();

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-secondary/30 rounded-xl border border-border text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Lock className="h-8 w-8 text-primary" />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground mb-2">
        {plan === "free" ? "Premium Feature" : "Pro Feature"}
      </h3>
      <p className="text-muted-foreground text-sm mb-4 max-w-sm">
        {getUpgradeMessage(displayName)}
      </p>
      {onUpgrade && (
        <Button onClick={onUpgrade} className="gap-2">
          {plan === "free" ? (
            <>
              <Sparkles className="h-4 w-4" />
              Upgrade to Plus
            </>
          ) : (
            <>
              <Crown className="h-4 w-4" />
              Upgrade to Pro
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default FeatureGate;
