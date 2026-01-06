"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: PlanFeature[];
  popular?: boolean;
  ctaText: string;
  ctaVariant: "default" | "outline" | "secondary";
  planId: string;
}

const plans: PricingPlan[] = [
  {
    name: "Free",
    description: "Perfect for trying out TalkPDF AI",
    monthlyPrice: 0,
    yearlyPrice: 0,
    planId: "free",
    features: [
      { text: "5 minutes audio/day", included: true },
      { text: "Standard AI voices", included: true },
      { text: "English only", included: true },
      { text: "Basic badge system", included: true },
      { text: "Explain-Back Mode", included: false },
      { text: "Offline downloads", included: false },
    ],
    ctaText: "Current Plan",
    ctaVariant: "outline",
  },
  {
    name: "Student Pro",
    description: "For students who want more learning time",
    monthlyPrice: 2000,
    yearlyPrice: 20000,
    planId: "student_pro",
    features: [
      { text: "60 minutes audio/day", included: true },
      { text: "Premium AI voices", included: true },
      { text: "All 5 languages", included: true },
      { text: "Full badge system", included: true },
      { text: "Explain-Back Mode", included: true },
      { text: "Offline downloads", included: false },
    ],
    ctaText: "Get Student Pro",
    ctaVariant: "secondary",
  },
  {
    name: "Mastery Pass",
    description: "Unlimited learning for serious students",
    monthlyPrice: 3500,
    yearlyPrice: 40000,
    planId: "mastery_pass",
    popular: true,
    features: [
      { text: "Unlimited audio", included: true },
      { text: "Premium AI voices", included: true },
      { text: "All 5 languages", included: true },
      { text: "Full badge system", included: true },
      { text: "Explain-Back Mode", included: true },
      { text: "Offline downloads", included: true },
    ],
    ctaText: "Get Mastery Pass",
    ctaVariant: "default",
  },
];

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

const calculateSavings = (monthly: number, yearly: number) => {
  if (monthly === 0) return 0;
  const yearlyFromMonthly = monthly * 12;
  const savings = ((yearlyFromMonthly - yearly) / yearlyFromMonthly) * 100;
  return Math.round(savings);
};

interface SubscriptionPlansProps {
  currentPlan?: string;
}

const SubscriptionPlans = ({ currentPlan = "free" }: SubscriptionPlansProps) => {
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (plan: PricingPlan) => {
    if (plan.monthlyPrice === 0 || plan.planId === currentPlan) {
      return;
    }

    setLoadingPlan(plan.planId);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        toast.error("Please sign in to subscribe");
        return;
      }

      const billingCycle = isAnnual ? "yearly" : "monthly";

      const { data, error } = await supabase.functions.invoke("flutterwave-payment", {
        body: {
          plan: plan.planId,
          billingCycle,
        },
      });

      if (error) {
        console.error("Payment error:", error);
        toast.error("Failed to initialize payment. Please try again.");
        return;
      }

      if (data?.paymentLink) {
        window.location.href = data.paymentLink;
      } else {
        toast.error("Failed to get payment link. Please try again.");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          Upgrade Your Plan
        </h2>
        <p className="text-muted-foreground">
          Choose the plan that fits your learning journey.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span
          className={cn(
            "text-sm font-medium transition-colors",
            !isAnnual ? "text-foreground" : "text-muted-foreground"
          )}
        >
          Monthly
        </span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          className={cn(
            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isAnnual ? "bg-primary" : "bg-muted"
          )}
          role="switch"
          aria-checked={isAnnual}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow-lg ring-0 transition-transform",
              isAnnual ? "translate-x-8" : "translate-x-1"
            )}
          />
        </button>
        <span
          className={cn(
            "text-sm font-medium transition-colors flex items-center gap-2",
            isAnnual ? "text-foreground" : "text-muted-foreground"
          )}
        >
          Annually
          <span className="inline-flex items-center gap-1 bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full text-xs font-semibold">
            <Sparkles className="h-3 w-3" />
            Save 17%
          </span>
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const price = isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
          const savings = calculateSavings(plan.monthlyPrice, plan.yearlyPrice);
          const isLoading = loadingPlan === plan.planId;
          const isCurrentPlan = plan.planId === currentPlan;

          return (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-xl p-5 transition-all duration-300",
                plan.popular
                  ? "bg-primary text-primary-foreground shadow-elevated"
                  : "bg-secondary/50 border border-border"
              )}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-2 py-0.5 rounded-full text-xs font-semibold">
                    <Sparkles className="h-3 w-3" />
                    Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-4">
                <h3
                  className={cn(
                    "font-display text-lg font-bold mb-1",
                    plan.popular ? "text-primary-foreground" : "text-foreground"
                  )}
                >
                  {plan.name}
                </h3>
                <p
                  className={cn(
                    "text-xs",
                    plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "font-display text-2xl font-bold",
                      plan.popular ? "text-primary-foreground" : "text-foreground"
                    )}
                  >
                    {price === 0 ? "₦0" : formatPrice(price)}
                  </span>
                  {price > 0 && (
                    <span
                      className={cn(
                        "text-xs",
                        plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      /{isAnnual ? "year" : "month"}
                    </span>
                  )}
                </div>
                {isAnnual && savings > 0 && (
                  <p
                    className={cn(
                      "text-xs mt-1",
                      plan.popular ? "text-primary-foreground/80" : "text-primary"
                    )}
                  >
                    Save {savings}%
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-4">
                {plan.features.map((feature, index) => (
                  <li
                    key={index}
                    className={cn(
                      "flex items-start gap-2 text-xs",
                      !feature.included && (plan.popular ? "opacity-50" : "text-muted-foreground/60")
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3 w-3 mt-0.5 flex-shrink-0",
                        feature.included
                          ? plan.popular
                            ? "text-primary-foreground"
                            : "text-primary"
                          : plan.popular
                          ? "text-primary-foreground/40"
                          : "text-muted-foreground/40"
                      )}
                    />
                    <span
                      className={cn(
                        feature.included
                          ? plan.popular
                            ? "text-primary-foreground"
                            : "text-foreground"
                          : plan.popular
                          ? "text-primary-foreground/50 line-through"
                          : "text-muted-foreground line-through"
                      )}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Button
                className={cn(
                  "w-full",
                  plan.popular &&
                    "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                )}
                variant={plan.popular ? "secondary" : plan.ctaVariant}
                size="sm"
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading || isCurrentPlan}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : isCurrentPlan ? (
                  "Current Plan"
                ) : (
                  plan.ctaText
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionPlans;
