

# Implementation Plan: Enhanced Credit System, Validation, and Question Limits

This plan addresses four key improvements to the TalkPDF AI platform to ensure profitability and better user experience.

---

## Overview

| Task | Description | Complexity |
|------|-------------|------------|
| 1. Character Limit Warning | Real-time warning as users approach 4,000 characters | Low |
| 2. Credit Usage Optimization | Revised credit costs based on AI/TTS costs | Medium |
| 3. Smart Truncation | Preserve user questions, truncate context first | Low |
| 4. Question Limits by Plan | Limit AI questions in Read & Learn by subscription | Medium |

---

## Task 1: Client-Side Character Limit Validation

### What We'll Build
A visual character counter with color-coded warnings that appears in:
- Support Chatbot input field
- Document Reader "Ask a Question" textarea

### User Experience
- Character count displays below input (e.g., "245 / 4,000")
- **Green**: Under 3,500 characters
- **Yellow Warning**: 3,500-3,900 characters
- **Red Alert**: 3,900-4,000 characters
- **Disabled send button**: At 4,000+ characters with message "Message too long"

### Files to Modify
- `src/components/SupportChatbot.tsx` - Add character counter below input
- `src/components/dashboard/DocumentReader.tsx` - Add counter to question textarea

---

## Task 2: Revised Credit Usage Charges

### Current vs. Proposed Credits

Based on actual AI costs (Lovable AI, ElevenLabs TTS, YarnGPT):

| Action | Current Cost | Proposed Cost | Justification |
|--------|-------------|---------------|---------------|
| **PDF Upload** | 1 credit | 2 credits | Gemini text extraction + summary + study prompts generation |
| **Audio (per 5 min)** | 1 credit | 2 credits | TTS is expensive (ElevenLabs/YarnGPT) |
| **Explain-Back** | 2 credits | 3 credits | Uses Gemini Pro for evaluation (most expensive model) |
| **Quiz Generation** | 1 credit | 2 credits | Uses Gemini Pro for structured quiz creation |
| **Micro Lesson** | 1 credit | 1 credit | Keep affordable for engagement |
| **AI Question (NEW)** | Not tracked | 1 credit | Uses Gemini Flash for support chatbot |

### Plan Credit Allocations

| Plan | Current Credits | Proposed Credits | Reasoning |
|------|----------------|------------------|-----------|
| Free | 0 | 0 | No change - limited by daily caps |
| Plus | 100 | 150 | +50% to offset increased costs |
| Pro | 500 | 500 | No change |

### Files to Modify
- `src/components/dashboard/CreditsUsageTracker.tsx` - Update `CREDIT_COSTS` and display
- `src/hooks/useFeatureAccess.ts` - Update `PLAN_FEATURES.credits`
- Backend edge functions already track usage; no changes needed there

---

## Task 3: Smart Truncation Strategy

### Problem
Current approach cuts entire message at 4,000 characters, potentially losing the user's question.

### Solution
Prioritize keeping the user's question intact while truncating context/document content.

### Algorithm
```text
1. Calculate user question length
2. Reserve space for question + formatting (question + 100 chars buffer)
3. Truncate document context to fit remaining space
4. Never truncate user's question
```

### Example
If user asks a 500-character question about a 10,000-character document:
- Reserve: 500 + 100 = 600 chars for question
- Available for context: 4,000 - 600 = 3,400 chars
- Truncate document summary to 3,400 chars

### Files to Modify
- `src/components/dashboard/DocumentReader.tsx` - Update `clampSupportMessage` to smart truncation helper

---

## Task 4: Question Limits in Read & Learn by Subscription

### New Daily Limits

| Plan | Questions per Day | Justification |
|------|-------------------|---------------|
| Free | 5 | Enough to try the feature |
| Plus | 30 | Regular study sessions |
| Pro | Unlimited | Power users |

### Database Changes
Add `ai_questions_asked` column to `daily_usage_summary` table:

```sql
ALTER TABLE daily_usage_summary 
ADD COLUMN ai_questions_asked INTEGER DEFAULT 0;
```

### Frontend Changes

1. **Track question count** - Call usage tracking on each AI question
2. **Check limit before asking** - Verify remaining questions
3. **Show limit UI** - Display "X / Y questions today" with progress bar
4. **Upgrade prompt** - When limit reached, show upgrade CTA

### Backend Changes
Update `support-chatbot` edge function to:
1. Check if this is a "read & learn" question (via metadata)
2. Verify user hasn't exceeded plan limit
3. Return 403 with upgrade message if exceeded

### Files to Modify
- `src/hooks/useUsageLimits.ts` - Add `ai_questions_per_day` limit
- `src/components/dashboard/DocumentReader.tsx` - Add limit checking and UI
- `supabase/functions/support-chatbot/index.ts` - Add limit enforcement
- Database migration for new column

---

## Technical Details

### New useUsageLimits Hook Updates

```typescript
// Add to PLAN_LIMITS
ai_questions_per_day: {
  free: 5,
  plus: 30,
  pro: -1  // Unlimited
}

// Add to DailyUsage
ai_questions_asked: number;
```

### DocumentReader Component Updates

```typescript
// Before asking question
const { canAskQuestion, remainingQuestions } = useUsageLimits();

if (!canAskQuestion()) {
  toast.error("Daily question limit reached. Upgrade for more!");
  return;
}

// Track usage after successful question
await supabase.from("usage_tracking").insert({
  user_id: session.user.id,
  action_type: "ai_question",
  metadata: { source: "document_reader", documentId: selectedDoc.id }
});
```

### Smart Truncation Helper

```typescript
function buildConstrainedMessage(
  userQuestion: string,
  contextPrefix: string,
  contextContent: string,
  maxTotal: number = 4000
): string {
  const BUFFER = 100; // Safety buffer
  const questionPart = `Question: ${userQuestion}`;
  const reservedForQuestion = questionPart.length + BUFFER;
  const availableForContext = maxTotal - reservedForQuestion;
  
  if (availableForContext <= 0) {
    // Question alone is too long
    return questionPart.slice(0, maxTotal - 3) + "...";
  }
  
  const truncatedContext = (contextPrefix + contextContent)
    .slice(0, availableForContext - 3) + "...";
  
  return `${truncatedContext}\n\n${questionPart}`;
}
```

---

## Implementation Order

1. **Task 1**: Character limit warnings (quick win, improves UX immediately)
2. **Task 3**: Smart truncation (fixes the root cause of 400 errors)
3. **Task 4**: Question limits (requires database migration)
4. **Task 2**: Credit adjustments (requires careful communication to users)

---

## Testing Checklist

After implementation, verify:
- [ ] Character counter shows in SupportChatbot and DocumentReader
- [ ] Warning colors change at 3,500 and 3,900 characters
- [ ] Send button disables at 4,000+ characters
- [ ] Long documents get truncated while preserving user's question
- [ ] Free users see limit (5 questions) and upgrade prompt
- [ ] Plus users have 30 questions/day limit
- [ ] Pro users have unlimited questions
- [ ] Credit costs display correctly in CreditsUsageTracker
- [ ] Usage tracking records `ai_question` action type

