

# Implementation Plan: Revised Onboarding & Updated Pricing Structure

This plan streamlines the onboarding experience to focus on essential features and updates pricing to reflect the new credit limits and "Read & Learn" feature.

---

## Overview

| Task | Description | Files to Modify |
|------|-------------|-----------------|
| 1. Streamline Onboarding | Reduce from 7 steps to 5 essential steps | `OnboardingGuide.tsx` |
| 2. Update Dashboard Pricing | Reflect new credits, add Read & Learn feature | `SubscriptionPlans.tsx` |
| 3. Update Landing Pricing | Same updates for landing page | `Pricing.tsx` |

---

## Task 1: Streamlined Onboarding Flow

### Current Steps (7 total)
1. Welcome
2. Upload PDFs
3. Explain-Back Mode
4. Achievement Milestones  
5. Study Groups
6. Smart Notifications
7. Complete

### Proposed Steps (5 total)
1. **Welcome** - Keep (essential introduction)
2. **Upload PDFs** - Keep (core feature)
3. **Read & Learn** - NEW (replace Explain-Back with broader Read & Learn feature that includes AI Q&A)
4. **Listen & Review** - NEW (combines Audio + Quiz + Spaced Repetition into one step)
5. **Complete** - Keep (call to action)

### Removed Steps
- ❌ Achievement Milestones - Secondary feature, users discover naturally
- ❌ Study Groups - Secondary feature, not core workflow
- ❌ Smart Notifications - Can be discovered in settings

### New Step Content

**Step 3: Read & Learn**
- Icon: `BookOpen`
- Title: "Read & Learn with AI"
- Description: "Read your documents page-by-page. Tap 'Explain This' for AI explanations or ask questions about any topic. Your daily question limit depends on your plan."
- Action: "Go to My Docs tab"

**Step 4: Listen & Review**
- Icon: `Headphones`
- Title: "Listen & Test Yourself"
- Description: "Listen to audio lessons, take quizzes to test your understanding, and use spaced repetition to remember what you learn. Track your progress with achievements."
- Action: "Go to My Docs tab"

---

## Task 2: Update Dashboard Pricing (SubscriptionPlans.tsx)

### Changes for All Plans

**Free Plan Features:**
- 5 minutes audio per day
- 2 PDF uploads per day
- English language only
- **5 AI questions per day (Read & Learn)** ← NEW
- Quiz access
- Quiz leaderboard access

**Plus Plan Features:**
- **150 monthly credits** ← Updated from 100
- 60 minutes audio per day
- 20 PDF uploads per day
- 3 Nigerian languages (Yoruba, Igbo, Pidgin)
- **30 AI questions per day (Read & Learn)** ← NEW
- Voice Q&A with explanations (Explain-Back)
- Quiz & Quiz Leaderboard access
- Bronze & Silver badges
- Basic micro-lessons
- Email support

**Pro Plan Features:**
- 500 monthly credits
- Unlimited audio generation
- Unlimited PDF uploads
- All 5 Nigerian languages
- **Unlimited AI questions (Read & Learn)** ← NEW
- Real-time explanation validation (Explain-Back)
- Quiz & Quiz Leaderboard access
- 1-Minute Mastery micro-lessons
- All badge levels
- Campus leaderboard access
- WhatsApp integration (Coming Soon)
- Offline mode & audio download
- Priority support

---

## Task 3: Update Landing Page Pricing (Pricing.tsx)

### Same Changes as Dashboard

Apply identical feature updates to the landing page pricing section:
- Update Plus credits from 100 → 150
- Add "Read & Learn" AI questions feature to all plans
- Ensure feature lists match between dashboard and landing page

---

## Technical Implementation

### OnboardingGuide.tsx Changes

```typescript
// Updated steps array - reduced from 7 to 5
const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "Welcome to TalkPDF AI! 🎉",
    description: "Let's take a quick tour. TalkPDF AI converts your PDFs into interactive audio lessons in Nigerian languages.",
  },
  {
    id: "upload",
    icon: Upload,
    title: "Upload Your PDFs",
    description: "Upload your study materials. Our AI converts them into audio lessons and creates study prompts you can explore.",
    action: "Go to Upload tab",
  },
  {
    id: "read",
    icon: BookOpen,
    title: "Read & Learn with AI",
    description: "Read documents page-by-page. Tap 'Explain This' for AI explanations or ask questions about any topic.",
    action: "Go to My Docs tab",
  },
  {
    id: "listen",
    icon: Headphones,
    title: "Listen & Test Yourself",
    description: "Listen to audio lessons, take quizzes, and use spaced repetition to remember what you learn.",
    action: "Go to My Docs tab",
  },
  {
    id: "complete",
    icon: CheckCircle,
    title: "You're All Set! 🚀",
    description: "Upload your first PDF and start learning. Na you go excel!",
  },
];

// Update tabMap for navigation
const tabMap: Record<string, string> = {
  upload: "upload",
  read: "documents",
  listen: "documents",
};
```

### SubscriptionPlans.tsx & Pricing.tsx Changes

```typescript
// Updated plans array
const plans: PricingPlan[] = [
  {
    name: "Free",
    features: [
      { text: "5 minutes audio per day", included: true },
      { text: "2 PDF uploads per day", included: true },
      { text: "5 AI questions per day (Read & Learn)", included: true }, // NEW
      { text: "English language only", included: true },
      { text: "Quiz access", included: true },
      { text: "Quiz leaderboard access", included: true },
    ],
    // ... rest stays same
  },
  {
    name: "Plus",
    features: [
      { text: "150 monthly credits", included: true }, // Updated
      { text: "60 minutes audio per day", included: true },
      { text: "20 PDF uploads per day", included: true },
      { text: "30 AI questions per day (Read & Learn)", included: true }, // NEW
      { text: "3 Nigerian languages (Yoruba, Igbo, Pidgin)", included: true },
      { text: "Voice Q&A with explanations (Explain-Back)", included: true },
      { text: "Quiz & Quiz Leaderboard access", included: true },
      { text: "Bronze & Silver badges", included: true },
      { text: "Basic micro-lessons", included: true },
      { text: "Email support", included: true },
    ],
    // ... rest stays same
  },
  {
    name: "Pro",
    features: [
      { text: "500 monthly credits", included: true },
      { text: "Unlimited audio generation", included: true },
      { text: "Unlimited PDF uploads", included: true },
      { text: "Unlimited AI questions (Read & Learn)", included: true }, // NEW
      { text: "All 5 Nigerian languages (including Igbo, Hausa)", included: true },
      { text: "Real-time explanation validation (Explain-Back)", included: true },
      { text: "Quiz & Quiz Leaderboard access", included: true },
      { text: "1-Minute Mastery micro-lessons", included: true },
      { text: "All badge levels (Bronze, Silver, Gold)", included: true },
      { text: "Campus leaderboard access", included: true },
      { text: "WhatsApp integration", included: true, comingSoon: true },
      { text: "Offline mode & audio download", included: true },
      { text: "Priority support", included: true },
    ],
    // ... rest stays same
  },
];
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/OnboardingGuide.tsx` | Reduce to 5 steps, update content, add BookOpen and Headphones icons |
| `src/components/dashboard/SubscriptionPlans.tsx` | Update Plus credits to 150, add Read & Learn feature to all plans |
| `src/components/landing/Pricing.tsx` | Same pricing updates as dashboard |

---

## Testing Checklist

After implementation, verify:
- [ ] Onboarding shows 5 steps (not 7)
- [ ] "Go to My Docs tab" navigation works for Read & Listen steps
- [ ] Plus plan shows "150 monthly credits"
- [ ] All plans show "AI questions per day (Read & Learn)" feature
- [ ] Landing page pricing matches dashboard pricing
- [ ] Step indicators (dots) update correctly during onboarding

