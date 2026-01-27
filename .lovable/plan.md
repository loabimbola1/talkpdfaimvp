

# Implementation Plan: 5 Critical Updates

## Issue 1: Admin Panel - Suspicious Referral Moderation Section

### Problem
Admins need to review flagged suspicious referral activity for manual moderation.

### Files to Modify
- `src/components/dashboard/AdminReferralAnalytics.tsx`

### Solution
Add a new "Suspicious Activity" section to the AdminReferralAnalytics component that:
1. Fetches referrals where `flagged_suspicious = true` or where patterns indicate abuse (same IP multiple times, rapid signups)
2. Displays a table showing:
   - Referral code used
   - Referrer email
   - Referred user email  
   - IP address
   - User agent
   - Created date
   - Status (flagged/suspicious)
3. Add action buttons to:
   - Dismiss flag (mark as legitimate)
   - Revoke credits (if abuse confirmed)
   - Ban user (for severe cases)

### Code Changes
```typescript
// Add new state for suspicious referrals
const [suspiciousReferrals, setSuspiciousReferrals] = useState<any[]>([]);

// Add new fetch for suspicious activity
const { data: suspicious } = await supabase
  .from("referrals")
  .select("*")
  .or("flagged_suspicious.eq.true")
  .order("created_at", { ascending: false });

// Add IP frequency check
const ipCounts: Record<string, number> = {};
referrals?.forEach(r => {
  if (r.ip_address) {
    ipCounts[r.ip_address] = (ipCounts[r.ip_address] || 0) + 1;
  }
});

// Flag referrals from IPs with 3+ occurrences
const suspiciousIPs = Object.entries(ipCounts)
  .filter(([_, count]) => count >= 3)
  .map(([ip]) => ip);
```

### New Tab in Admin Panel
Add a dedicated "Suspicious" sub-section within the Referrals tab showing:
- Flagged referrals count badge
- Table with IP tracking columns
- Action buttons for moderation

---

## Issue 2: Revert to Lovable AI from OpenRouter

### Problem
The app was migrated to OpenRouter in a previous update. Now we need to revert back to Lovable AI Gateway.

### Current State (OpenRouter)
All 6 edge functions use:
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- API Key: `OPENROUTER_API_KEY`
- Models: `openai/gpt-4-turbo` and `google/gemini-flash-1.5`

### Target State (Lovable AI)
- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`
- API Key: `LOVABLE_API_KEY`
- Models:
  - `google/gemini-2.5-flash` for fast tasks (summarization, support chat, TTS)
  - `google/gemini-2.5-pro` for complex reasoning (quiz generation, evaluation)

### Files to Modify
1. `supabase/functions/process-pdf/index.ts` - Text extraction, summarization
2. `supabase/functions/generate-quiz/index.ts` - Quiz generation
3. `supabase/functions/explain-back-evaluate/index.ts` - Evaluation
4. `supabase/functions/generate-lesson-audio/index.ts` - Micro-lessons
5. `supabase/functions/support-chatbot/index.ts` - Support chat
6. `supabase/functions/voice-to-text/index.ts` - Transcription

### Code Changes (for each function)
```typescript
// BEFORE (OpenRouter):
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://www.talkpdf.online",
    "X-Title": "TalkPDF AI",
  },
  body: JSON.stringify({
    model: "google/gemini-flash-1.5", // or "openai/gpt-4-turbo"
    // ...
  }),
});

// AFTER (Lovable AI):
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash", // or "google/gemini-2.5-pro"
    // ...
  }),
});
```

### Model Selection Strategy (Lovable AI)
| Function | Use Case | Model |
|----------|----------|-------|
| process-pdf | Text extraction & summarization | `google/gemini-2.5-flash` |
| generate-quiz | Structured quiz generation | `google/gemini-2.5-pro` |
| explain-back-evaluate | Nuanced feedback | `google/gemini-2.5-pro` |
| generate-lesson-audio | Fast micro-lessons | `google/gemini-2.5-flash` |
| support-chatbot | Conversational support | `google/gemini-2.5-flash` |
| voice-to-text | Audio transcription | `google/gemini-2.5-flash` |

---

## Issue 3: Fix Stale Data / Browser Caching Issues

### Problem
Data appears stale after site updates until users use incognito mode or re-login. Affects:
- Daily usage counters (PDFs Uploaded)
- Credit balance
- Subscription status

### Root Cause
React Query and Supabase client cache responses. The supabase client also persists sessions in localStorage. When the app is redeployed, cached data may conflict with fresh server data.

### Files to Modify
- `src/hooks/useUsageLimits.ts`
- `src/hooks/useFeatureAccess.ts`
- `src/hooks/useDocuments.ts`
- `src/components/dashboard/CreditsUsageTracker.tsx`
- `src/main.tsx` (add cache invalidation)

### Solution
1. **Add `staleTime: 0` to critical React Query calls** - Force fresh data every time
2. **Add version-based cache invalidation** - Clear localStorage on app version change
3. **Add explicit cache control headers** - Prevent browser caching of API responses
4. **Refetch on window focus** - Auto-refresh when user returns to tab

### Code Changes

**1. Add version tracking in `src/main.tsx`:**
```typescript
// Clear stale cache on version update
const APP_VERSION = "2.0.0"; // Increment on each deploy
const cachedVersion = localStorage.getItem("app_version");
if (cachedVersion !== APP_VERSION) {
  // Clear specific caches that may be stale
  localStorage.removeItem("sb-jpcdklqqhoewdnpgpjep-auth-token");
  localStorage.setItem("app_version", APP_VERSION);
  // Force page reload to get fresh data
  window.location.reload();
}
```

**2. Update `useUsageLimits.ts`:**
```typescript
// Add dependency on a timestamp to force fresh fetches
const [lastFetch, setLastFetch] = useState(Date.now());

// In fetchUsageData, add cache-busting
const fetchUsageData = useCallback(async () => {
  try {
    // Force fresh auth state
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }
    // ... rest of fetch with fresh data
  }
}, [lastFetch]); // Add lastFetch dependency
```

**3. Add refetch on focus in components:**
```typescript
useEffect(() => {
  const handleFocus = () => {
    refetch();
  };
  window.addEventListener("focus", handleFocus);
  return () => window.removeEventListener("focus", handleFocus);
}, [refetch]);
```

---

## Issue 4: Lock Igbo and Hausa Voices to Pro Only

### Current State
From `useFeatureAccess.ts`:
```typescript
export const LANGUAGE_ACCESS: Record<string, SubscriptionPlan[]> = {
  en: ["free", "plus", "pro"],  // English - all plans
  yo: ["plus", "pro"],          // Yoruba - Plus and Pro
  ig: ["plus", "pro"],          // Igbo - Plus and Pro ← Change to Pro only
  pcm: ["plus", "pro"],         // Pidgin - Plus and Pro
  ha: ["pro"],                  // Hausa - Pro only ✅ Already correct
};
```

### Target State
```typescript
export const LANGUAGE_ACCESS: Record<string, SubscriptionPlan[]> = {
  en: ["free", "plus", "pro"],  // English - all plans
  yo: ["plus", "pro"],          // Yoruba - Plus and Pro
  ig: ["pro"],                  // Igbo - Pro only ← CHANGE
  pcm: ["plus", "pro"],         // Pidgin - Plus and Pro  
  ha: ["pro"],                  // Hausa - Pro only ✅
};
```

### Files to Modify
1. `src/hooks/useFeatureAccess.ts` - Change LANGUAGE_ACCESS
2. `src/components/dashboard/PDFUpload.tsx` - Update UI labels
3. `src/components/landing/Pricing.tsx` - Update feature descriptions

### Code Changes

**`useFeatureAccess.ts`:**
```typescript
export const LANGUAGE_ACCESS: Record<string, SubscriptionPlan[]> = {
  en: ["free", "plus", "pro"],
  yo: ["plus", "pro"],
  ig: ["pro"],    // Changed from ["plus", "pro"]
  pcm: ["plus", "pro"],
  ha: ["pro"],
};

// Also update PLAN_FEATURES
plus: {
  languages: ["en", "yo", "pcm"], // Remove "ig"
  // ...
},
pro: {
  languages: ["en", "yo", "ig", "pcm", "ha"], // All 5
  // ...
},
```

**`PDFUpload.tsx`:**
```typescript
const languages = [
  { value: "en", label: "English", planRequired: "free" as const },
  { value: "yo", label: "Yoruba", planRequired: "plus" as const },
  { value: "ig", label: "Igbo", planRequired: "pro" as const },    // Changed
  { value: "pcm", label: "Pidgin", planRequired: "plus" as const },
  { value: "ha", label: "Hausa", planRequired: "pro" as const },
];
```

**`Pricing.tsx` - Plus plan features:**
```typescript
{ text: "2 Nigerian languages (Yoruba, Pidgin)", included: true },  // Remove Igbo
```

---

## Issue 5: Update Subscription Pricing

### Current Pricing
| Plan | Monthly | Annual |
|------|---------|--------|
| Plus | ₦2,000 | ₦20,000 |
| Pro | ₦3,500 | ₦40,000 |

### New Pricing
| Plan | Monthly | Annual | Badge |
|------|---------|--------|-------|
| Plus | ₦3,500 | ₦36,000 | "Popular" |
| Pro | ₦7,500 | ₦84,000 | (remove "Most Popular") |

### Files to Modify
1. `src/components/landing/Pricing.tsx` - Frontend pricing display
2. `supabase/functions/flutterwave-payment/index.ts` - Payment price map (server-side truth)

### Code Changes

**`Pricing.tsx`:**
```typescript
const plans: PricingPlan[] = [
  {
    name: "Free",
    // ... unchanged
  },
  {
    name: "Plus",
    description: "Great value for serious learners",
    monthlyPrice: 3500,     // Changed from 2000
    yearlyPrice: 36000,     // Changed from 20000
    priceLabel: "/month",
    planId: "plus",
    popular: true,          // ADD - Mark as Popular
    features: [
      { text: "100 monthly credits", included: true },
      { text: "60 minutes audio per day", included: true },
      { text: "20 PDF uploads per day", included: true },
      { text: "2 Nigerian languages (Yoruba, Pidgin)", included: true }, // Updated
      // ... rest unchanged
    ],
    ctaText: "Get Plus",
    ctaVariant: "default",  // Make primary button for popular
  },
  {
    name: "Pro",
    description: "For serious learners who want to excel",
    monthlyPrice: 7500,     // Changed from 3500
    yearlyPrice: 84000,     // Changed from 40000
    priceLabel: "/month",
    planId: "pro",
    popular: false,         // REMOVE Most Popular
    features: [
      { text: "500 monthly credits", included: true },
      { text: "All 5 Nigerian languages (including Igbo, Hausa)", included: true },
      // ... rest unchanged
    ],
    ctaText: "Get Pro",
    ctaVariant: "outline",  // Secondary button
  },
];
```

**`flutterwave-payment/index.ts` (CRITICAL - Server-side pricing):**
```typescript
// PRICE_MAP must match frontend exactly
const PRICE_MAP: Record<string, Record<BillingCycle, number>> = {
  plus: { monthly: 3500, yearly: 36000 },   // Updated
  pro: { monthly: 7500, yearly: 84000 },    // Updated
};
```

### Annual Savings Calculation
- Plus: ₦3,500 × 12 = ₦42,000 → ₦36,000 annual = **14% savings** (₦6,000 off)
- Pro: ₦7,500 × 12 = ₦90,000 → ₦84,000 annual = **7% savings** (₦6,000 off)

Note: The "Save up to 17%" text in the billing toggle should be updated to "Save up to 14%".

---

## Summary of Changes

| Issue | Files Modified | Type |
|-------|----------------|------|
| 1. Admin referral moderation | `AdminReferralAnalytics.tsx` | Frontend |
| 2. Revert to Lovable AI | 6 edge functions | Edge Functions |
| 3. Fix stale data caching | `main.tsx`, hooks | Frontend |
| 4. Lock Igbo/Hausa to Pro | `useFeatureAccess.ts`, `PDFUpload.tsx`, `Pricing.tsx` | Frontend |
| 5. Update pricing | `Pricing.tsx`, `flutterwave-payment/index.ts` | Frontend + Edge Function |

---

## Technical Notes

### Lovable AI vs OpenRouter
- **Lovable AI** uses `LOVABLE_API_KEY` (auto-provisioned)
- No additional API key setup required
- Supports `google/gemini-2.5-flash` and `google/gemini-2.5-pro`
- Rate limits apply per workspace

### Caching Fix Priority
The stale data issue is critical and affects user trust. The solution involves:
1. App version tracking in localStorage
2. Force-clearing auth tokens on version mismatch
3. Adding `refetchOnWindowFocus` pattern to hooks

### Pricing Update Impact
Existing subscribers are NOT affected - their current plan continues at old pricing. New pricing only applies to new subscriptions.

