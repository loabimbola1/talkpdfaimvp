import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Crown, AlertTriangle, Clock, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInDays, parseISO, format, addMonths, addYears } from "date-fns";

interface SubscriptionInfo {
  plan: string;
  status: string;
  startDate: string | null;
  expiryDate: string | null;
  billingCycle: string | null;
  daysRemaining: number;
}

interface SubscriptionStatusProps {
  onUpgrade?: () => void;
}

const SubscriptionStatus = ({ onUpgrade }: SubscriptionStatusProps) => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile for subscription info
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, subscription_status")
        .eq("user_id", user.id)
        .single();

      // Get latest successful payment for expiry calculation
      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (payment) {
        const startDate = parseISO(payment.created_at);
        let expiryDate: Date;
        
        if (payment.billing_cycle === "yearly") {
          expiryDate = addYears(startDate, 1);
        } else {
          expiryDate = addMonths(startDate, 1);
        }

        const daysRemaining = differenceInDays(expiryDate, new Date());

        setSubscription({
          plan: payment.plan,
          status: profile?.subscription_status || "active",
          startDate: payment.created_at,
          expiryDate: expiryDate.toISOString(),
          billingCycle: payment.billing_cycle,
          daysRemaining: Math.max(0, daysRemaining),
        });

        // Show renewal reminder if expiring soon
        if (daysRemaining <= 7 && daysRemaining > 0) {
          toast.warning(
            `Your ${payment.plan} subscription expires in ${daysRemaining} days. Renew now to avoid interruption!`,
            { duration: 10000 }
          );
        } else if (daysRemaining <= 0) {
          toast.error("Your subscription has expired. Upgrade to continue using premium features.");
        }
      } else {
        // Free plan
        setSubscription({
          plan: "free",
          status: "active",
          startDate: null,
          expiryDate: null,
          billingCycle: null,
          daysRemaining: -1,
        });
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const isExpiringSoon = subscription.daysRemaining >= 0 && subscription.daysRemaining <= 7;
  const isExpired = subscription.daysRemaining === 0;
  const isPremium = subscription.plan !== "free";

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border ${
        isExpired 
          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          : isExpiringSoon
          ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          : isPremium
          ? "bg-primary/5 border-primary/20"
          : "bg-secondary/30 border-border"
      }`}>
        <div className="flex items-start gap-3">
          {isPremium ? (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground capitalize">
                {subscription.plan} Plan
              </p>
              {isPremium && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isExpired 
                    ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                    : isExpiringSoon
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400"
                    : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                }`}>
                  {isExpired ? "Expired" : isExpiringSoon ? "Expiring Soon" : "Active"}
                </span>
              )}
            </div>

            {isPremium && subscription.expiryDate && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {isExpired 
                    ? `Expired on ${format(parseISO(subscription.expiryDate), "MMM d, yyyy")}`
                    : `Expires on ${format(parseISO(subscription.expiryDate), "MMM d, yyyy")}`
                  }
                </p>

                {!isExpired && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {subscription.daysRemaining} days remaining
                      </span>
                      <span className="text-muted-foreground capitalize">
                        {subscription.billingCycle}
                      </span>
                    </div>
                    <Progress 
                      value={Math.max(0, Math.min(100, (subscription.daysRemaining / 30) * 100))} 
                      className="h-1.5"
                    />
                  </div>
                )}
              </div>
            )}

            {!isPremium && (
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to unlock unlimited features
              </p>
            )}
          </div>

          {isExpired && (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          )}
          {isExpiringSoon && !isExpired && (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          )}
          {isPremium && !isExpired && !isExpiringSoon && (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
        </div>
      </div>

      {(isExpiringSoon || isExpired || !isPremium) && (
        <Button 
          onClick={onUpgrade} 
          className="w-full gap-2"
          variant={isExpired ? "destructive" : "default"}
        >
          <Crown className="h-4 w-4" />
          {isExpired ? "Renew Subscription" : isPremium ? "Renew Early" : "Upgrade Now"}
        </Button>
      )}
    </div>
  );
};

export default SubscriptionStatus;
