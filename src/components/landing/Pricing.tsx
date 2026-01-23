"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface PlanFeature {
  text: string;
  included: boolean;
  comingSoon?: boolean;
}

interface PricingPlan {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  priceLabel: string;
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
    priceLabel: "forever",
    planId: "free",
    features: [
      { text: "5 minutes audio per day", included: true },
      { text: "2 PDF uploads per day", included: true },
      { text: "English language only", included: true },
      { text: "Quiz access", included: true },
      { text: "Quiz leaderboard access", included: true },
    ],
    ctaText: "Start Free",
    ctaVariant: "outline",
  },
  {
    name: "Plus",
    description: "Great value for everyday learners",
    monthlyPrice: 2000,
    yearlyPrice: 20000,
    priceLabel: "/month",
    planId: "plus",
    features: [
      { text: "100 monthly credits", included: true },
      { text: "60 minutes audio per day", included: true },
      { text: "20 PDF uploads per month", included: true },
      { text: "3 Nigerian languages (Yoruba, Igbo, Pidgin)", included: true },
      { text: "Voice Q&A with explanations (Explain-Back)", included: true },
      { text: "Quiz & Quiz Leaderboard access", included: true },
      { text: "Bronze & Silver badges", included: true },
      { text: "Basic micro-lessons", included: true },
      { text: "Email support", included: true },
    ],
    ctaText: "Get Plus",
    ctaVariant: "outline",
  },
  {
    name: "Pro",
    description: "For serious learners who want to excel",
    monthlyPrice: 3500,
    yearlyPrice: 40000,
    priceLabel: "/month",
    planId: "pro",
    popular: true,
    features: [
      { text: "500 monthly credits", included: true },
      { text: "Unlimited audio generation", included: true },
      { text: "Unlimited PDF uploads", included: true },
      { text: "All 5 Nigerian languages", included: true },
      { text: "Real-time explanation validation (Explain-Back)", included: true },
      { text: "Quiz & Quiz Leaderboard access", included: true },
      { text: "1-Minute Mastery micro-lessons", included: true },
      { text: "All badge levels (Bronze, Silver, Gold)", included: true },
      { text: "Campus leaderboard access", included: true },
      { text: "WhatsApp integration", included: true, comingSoon: true },
      { text: "Offline mode & audio download", included: true },
      { text: "Priority support", included: true },
    ],
    ctaText: "Get Pro",
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

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubscribe = async (plan: PricingPlan) => {
    if (plan.monthlyPrice === 0) {
      navigate("/auth");
      return;
    }

    setLoadingPlan(plan.planId);

    try {
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        toast.info("Please sign in to subscribe");
        navigate("/auth");
        return;
      }

      const price = isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
      const billingCycle = isAnnual ? "yearly" : "monthly";

      const { data, error } = await supabase.functions.invoke("flutterwave-payment", {
        body: {
          amount: price,
          plan: plan.planId,
          billingCycle,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email,
          userId: session.user.id,
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
    <section id="pricing" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted-foreground text-lg">
            Choose the plan that fits your learning journey. Save more with annual billing.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10 md:mb-14">
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
              "relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
              <Sparkles className="h-3 w-3" />
              Save up to 17%
            </span>
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto items-start">
          {plans.map((plan) => {
            const price = isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
            const savings = calculateSavings(plan.monthlyPrice, plan.yearlyPrice);
            const isLoading = loadingPlan === plan.planId;

            return (
              <div
                key={plan.name}
                className={cn(
                  "relative rounded-2xl p-6 md:p-8 transition-all duration-300 flex flex-col",
                  plan.popular
                    ? "bg-foreground text-background shadow-elevated md:scale-105 z-10"
                    : "bg-card border border-border shadow-card hover:shadow-elevated"
                )}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-6">
                  <h3
                    className={cn(
                      "font-display text-xl font-bold mb-1",
                      plan.popular ? "text-background" : "text-foreground"
                    )}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={cn(
                      "text-sm",
                      plan.popular ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={cn(
                        "font-display text-4xl md:text-5xl font-bold",
                        plan.popular ? "text-background" : "text-foreground"
                      )}
                    >
                      {price === 0 ? "₦0" : formatPrice(price)}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        plan.popular ? "text-background/60" : "text-muted-foreground"
                      )}
                    >
                      {price === 0 ? plan.priceLabel : (isAnnual ? "/year" : "/month")}
                    </span>
                  </div>
                  {isAnnual && savings > 0 && (
                    <p
                      className={cn(
                        "text-sm mt-1",
                        plan.popular ? "text-primary" : "text-primary"
                      )}
                    >
                      Save {savings}% compared to monthly
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 mt-0.5 flex-shrink-0",
                          plan.popular
                            ? "text-primary"
                            : "text-primary"
                        )}
                      />
                      <span
                        className={cn(
                          "flex items-center gap-2",
                          plan.popular
                            ? "text-background/90"
                            : "text-foreground"
                        )}
                      >
                        {feature.text}
                        {feature.comingSoon && (
                          <Badge variant="outline" className={cn(
                            "text-[10px] px-1.5 py-0",
                            plan.popular ? "border-background/30 text-background/70" : ""
                          )}>
                            Coming Soon
                          </Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  className={cn(
                    "w-full",
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : plan.ctaVariant === "outline" 
                        ? "border-primary text-primary hover:bg-primary/10"
                        : ""
                  )}
                  variant={plan.popular ? "default" : plan.ctaVariant}
                  size="lg"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {plan.popular && <Zap className="h-4 w-4 mr-2" />}
                      {plan.ctaText}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Trust Note */}
        <p className="text-center text-muted-foreground text-sm mt-10">
          All plans include a 7-day free trial. Cancel anytime. No hidden fees.
        </p>
      </div>
    </section>
  );
};

export default Pricing;
