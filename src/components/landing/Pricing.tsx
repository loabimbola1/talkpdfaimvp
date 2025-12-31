"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const plans: PricingPlan[] = [
  {
    name: "Free",
    description: "Perfect for trying out TalkPDF AI",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { text: "5 minutes audio/day", included: true },
      { text: "Standard AI voices", included: true },
      { text: "English only", included: true },
      { text: "Basic badge system", included: true },
      { text: "Explain-Back Mode", included: false },
      { text: "Offline downloads", included: false },
      { text: "Priority support", included: false },
    ],
    ctaText: "Start Free",
    ctaVariant: "outline",
  },
  {
    name: "Student Pro",
    description: "For students who want more learning time",
    monthlyPrice: 2000,
    yearlyPrice: 20000,
    features: [
      { text: "60 minutes audio/day", included: true },
      { text: "Premium AI voices", included: true },
      { text: "All 5 languages", included: true },
      { text: "Full badge system", included: true },
      { text: "Explain-Back Mode", included: true },
      { text: "Offline downloads", included: false },
      { text: "Priority support", included: false },
    ],
    ctaText: "Get Student Pro",
    ctaVariant: "secondary",
  },
  {
    name: "Mastery Pass",
    description: "Unlimited learning for serious students",
    monthlyPrice: 3500,
    yearlyPrice: 40000,
    popular: true,
    features: [
      { text: "Unlimited audio", included: true },
      { text: "Premium AI voices", included: true },
      { text: "All 5 languages", included: true },
      { text: "Full badge system", included: true },
      { text: "Explain-Back Mode", included: true },
      { text: "Offline downloads", included: true },
      { text: "Priority support", included: true },
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

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="py-16 md:py-24 bg-secondary/30">
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
            <span className="inline-flex items-center gap-1 bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full text-xs font-semibold">
              <Sparkles className="h-3 w-3" />
              Save up to 17%
            </span>
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const price = isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
            const savings = calculateSavings(plan.monthlyPrice, plan.yearlyPrice);

            return (
              <div
                key={plan.name}
                className={cn(
                  "relative rounded-2xl p-6 md:p-8 transition-all duration-300",
                  plan.popular
                    ? "bg-primary text-primary-foreground shadow-elevated scale-[1.02] md:scale-105 z-10"
                    : "bg-card border border-border shadow-card hover:shadow-elevated"
                )}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
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
                      plan.popular ? "text-primary-foreground" : "text-foreground"
                    )}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={cn(
                      "text-sm",
                      plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"
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
                        plan.popular ? "text-primary-foreground" : "text-foreground"
                      )}
                    >
                      {price === 0 ? "₦0" : formatPrice(price)}
                    </span>
                    {price > 0 && (
                      <span
                        className={cn(
                          "text-sm",
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
                        "text-sm mt-1",
                        plan.popular ? "text-primary-foreground/80" : "text-primary"
                      )}
                    >
                      Save {savings}% compared to monthly
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li
                      key={index}
                      className={cn(
                        "flex items-start gap-3 text-sm",
                        !feature.included && (plan.popular ? "opacity-50" : "text-muted-foreground/60")
                      )}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 mt-0.5 flex-shrink-0",
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
                  size="lg"
                >
                  {plan.ctaText}
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
