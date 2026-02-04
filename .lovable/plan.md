
# Implementation Plan: Page Navigation, Credit Sync, and AI Quality

This plan addresses three user requests:
1. Page-by-page navigation and audio playback for PDFs (Plus/Pro only)
2. Credit/usage synchronization across different device browsers
3. Reducing AI hallucinations, filler words, and repetition

---

## Request 1: Page-Level Navigation with Audio and Explain-Back

### Current State
The system extracts PDF content as a single block and generates AI-summarized **concepts** (stored in `study_prompts`). Users navigate between concepts, not actual PDF pages.

### Solution Overview

```text
User uploads PDF
       ↓
┌─────────────────────────────────────────────────────┐
│ process-pdf Edge Function (Enhanced)                │
│ ├─ Extract text page-by-page for Plus/Pro users    │
│ ├─ Store as page_contents: [{page: 1, text: ...}]  │
│ └─ Continue generating concepts as before          │
└─────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────┐
│ DocumentReader Component (Enhanced)                 │
│ ├─ View Mode Toggle: [Concepts] [Pages]            │
│ ├─ Page Navigation: dropdown + prev/next buttons   │
│ ├─ "Listen to This Page" button                    │
│ └─ Free users see concepts only + upgrade prompt   │
└─────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────┐
│ ExplainBackMode Component (Enhanced)                │
│ ├─ Support both concept mode and page mode         │
│ └─ Test understanding based on selected page text  │
└─────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Database Schema Update

Add a new column to store page-by-page content:

```sql
ALTER TABLE public.documents 
ADD COLUMN page_contents JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.documents.page_contents IS 
'Page text array: [{"page": 1, "text": "..."}, ...]';
```

#### Step 2: Update process-pdf Edge Function

Modify the PDF extraction to request page-by-page content for Plus/Pro users:

**Changes to `supabase/functions/process-pdf/index.ts`:**
- Add a new AI prompt that extracts text with page markers
- Store extracted pages in the new `page_contents` column  
- Set `page_count` from the number of pages extracted
- Plan-based page limits: Plus (30 pages), Pro (50 pages)

#### Step 3: Update DocumentReader Component

Enhance `src/components/dashboard/DocumentReader.tsx` with:

**New UI Elements (Plus/Pro only):**
- View mode toggle (radio buttons): Concepts | Pages
- Page navigation: dropdown selector + prev/next arrows
- "Listen to This Page" button
- Page content display area

**New State:**
```typescript
const [viewMode, setViewMode] = useState<"concepts" | "pages">("concepts");
const [currentPageIndex, setCurrentPageIndex] = useState(0);
```

#### Step 4: Update ExplainBackMode Component

Modify `src/components/dashboard/ExplainBackMode.tsx` to:
- Accept optional `pageIndex` and `isPageMode` props
- When in page mode, use page text as the content to test
- Pass page text to the `explain-back-evaluate` function

#### Step 5: Update useDocuments Hook

Add `page_contents` and `page_count` to the Document interface and SELECT query.

---

## Request 2: Credit Balance Sync Across Devices

### Root Cause
The current implementation fetches usage data once on component mount. There are no real-time subscriptions to detect changes from other devices.

### Solution: Real-time Subscriptions + Visibility Refresh

#### Step 1: Update useUsageLimits Hook

Add to `src/hooks/useUsageLimits.ts`:

**Real-time subscription:**
```typescript
useEffect(() => {
  const setupSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const channel = supabase
      .channel(`usage-${session.user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public", 
        table: "daily_usage_summary",
        filter: `user_id=eq.${session.user.id}`,
      }, () => fetchUsageData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  };
  // ... setup
}, [fetchUsageData]);
```

**Visibility change listener:**
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      fetchUsageData();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
}, [fetchUsageData]);
```

#### Step 2: Update CreditsUsageTracker Component

Add similar real-time subscriptions to `src/components/dashboard/CreditsUsageTracker.tsx`:
- Subscribe to `profiles` table for plan/credit changes
- Subscribe to `usage_tracking` table for usage updates
- Add visibility change listener for tab switching

#### Step 3: Enable Realtime on Tables (Database Migration)

```sql
-- Enable realtime for usage tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_usage_summary;
ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_tracking;
```

---

## Request 3: Reduce AI Hallucinations, Filler Words, and Repetition

### Strategy
Add explicit anti-hallucination instructions to AI system prompts and lower temperature settings for more factual responses.

#### Step 1: Update support-chatbot System Prompt

Add to `supabase/functions/support-chatbot/index.ts`:

```text
RESPONSE QUALITY RULES:
1. NEVER fabricate information - if unsure, say so honestly
2. AVOID filler phrases: "That's a great question!", "I'd be happy to help!"
3. DO NOT repeat the same point multiple times
4. Get straight to the answer without preamble
5. Base answers ONLY on provided context - do not invent content
```

Lower temperature from 0.7 to 0.5.

#### Step 2: Update generate-lesson-audio System Prompt

Add to `supabase/functions/generate-lesson-audio/index.ts`:

```text
CONTENT QUALITY RULES:
1. DO NOT invent facts not in the document
2. AVOID filler phrases: "So basically...", "You know..."
3. DO NOT repeat explanations in different words
4. Be direct - every sentence should add value
```

Lower temperature from default to 0.6.

#### Step 3: Update explain-back-evaluate System Prompt

Add to `supabase/functions/explain-back-evaluate/index.ts`:

```text
EVALUATION ACCURACY RULES:
1. Base evaluation ONLY on provided document context
2. DO NOT assume knowledge not in the document
3. Be specific and actionable in feedback
```

Lower temperature from default to 0.4.

#### Step 4: Update process-pdf Summary Generation

Add anti-hallucination rules to the summary generation prompt in `supabase/functions/process-pdf/index.ts`.

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration (new) | Add `page_contents` column, enable realtime |
| `supabase/functions/process-pdf/index.ts` | Page-by-page extraction for Plus/Pro, anti-hallucination prompts |
| `supabase/functions/support-chatbot/index.ts` | Anti-hallucination prompts, lower temperature |
| `supabase/functions/generate-lesson-audio/index.ts` | Anti-filler prompts, lower temperature |
| `supabase/functions/explain-back-evaluate/index.ts` | Accuracy-focused prompts, lower temperature |
| `src/components/dashboard/DocumentReader.tsx` | View mode toggle, page navigation, page audio |
| `src/components/dashboard/ExplainBackMode.tsx` | Page mode support with props |
| `src/hooks/useDocuments.ts` | Add page_contents to Document interface |
| `src/hooks/useUsageLimits.ts` | Real-time subscription, visibility refresh |
| `src/components/dashboard/CreditsUsageTracker.tsx` | Real-time subscription, visibility refresh |

---

## Technical Notes

### Page Extraction Token Budget
- Plus users: Up to 30 pages extracted
- Pro users: Up to 50 pages extracted
- AI extraction uses structured JSON output

### Backwards Compatibility
- Existing documents without `page_contents` continue working (concepts-only mode)
- Free users see concepts view only (no page mode available)

### AI Temperature Settings

| Function | Current | New | Rationale |
|----------|---------|-----|-----------|
| support-chatbot | 0.7 | 0.5 | More factual, less creative |
| generate-lesson-audio | default | 0.6 | Balanced for engagement |
| explain-back-evaluate | default | 0.4 | High accuracy needed |

---

## Testing Checklist

### Page Navigation
- [ ] Upload PDF as Plus user - verify page_contents is populated
- [ ] View mode toggle appears for Plus/Pro users only
- [ ] Page dropdown navigation works correctly
- [ ] "Listen to Page" generates and plays audio
- [ ] "Test My Understanding" works with page content
- [ ] Free users see concepts only with upgrade prompt

### Credit Sync
- [ ] Open app on two devices, use credits on one
- [ ] Second device updates within seconds (realtime)
- [ ] Tab visibility refresh works (switch away and back)

### AI Quality
- [ ] Support chatbot responses have no filler phrases
- [ ] Concept explanations are factual, not hallucinated
- [ ] Explain-back feedback is specific and actionable
