
# Implementation Plan: 5 Tasks

## Summary
This plan addresses:
1. Nigerian academic context AI assistant for WAEC/NECO/UTME
2. Page-by-page/chapter learning from uploaded documents
3. Study reminder notification issues
4. Google Analytics implementation
5. Payment callback logo replacement

---

## Task 1: Nigerian Academic Context AI Assistant

**Goal**: Enhance the support chatbot and study features to provide curriculum-aligned academic help for WAEC, NECO, and UTME exam preparation.

### Files to Modify

**File: `supabase/functions/support-chatbot/index.ts`**
- Update the system prompt to include Nigerian university doctorate-level academic context
- Add knowledge of WAEC, NECO, UTME curricula and local academic terminology
- Support questions in local languages (Pidgin, Yoruba, Hausa, Igbo)
- Provide curriculum-aligned explanations and exam tips

**File: `src/components/SupportChatbot.tsx`**
- Add new knowledge base entries for Nigerian exam topics
- Include WAEC, NECO, JAMB/UTME specific keywords and responses

### Key Changes to System Prompt
```
You are a Nigerian academic tutor with doctorate-level expertise. You understand:
- WAEC, NECO, UTME/JAMB curricula and examination patterns
- Nigerian educational system from secondary to university level
- Local academic terminology and Nigerian English expressions
- Pre-university exam preparation strategies

Assist students with:
- Coursework and study materials
- Exam preparation and past question patterns
- Understanding academic concepts in local context
- Study tips tailored to Nigerian exam systems
```

---

## Task 2: Page-by-Page/Chapter Learning Feature

**Goal**: Allow users to study uploaded textbooks, PDFs, or course materials one page or chapter at a time.

### New Component Required

**File: `src/components/dashboard/DocumentReader.tsx` (New)**
- Document viewer with page/chapter navigation
- AI-powered explanation for each section
- Integration with existing documents from the database
- Language selection for explanations

### Implementation Approach

1. **Document Structure Detection**: Use AI to detect chapters/sections in uploaded documents during processing
2. **Chunked Content Storage**: Store extracted sections in a new database field or table
3. **Reader Interface**: Create a focused reading mode with:
   - Page/chapter navigation (prev/next buttons)
   - AI explanation panel for current section
   - Ask questions about the current page/chapter
   - Highlight key concepts
   - Audio playback for current section

### Database Changes
Add to documents table or create new table:
```sql
-- Option: Add sections array to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS 
  content_sections jsonb DEFAULT '[]'::jsonb;
```

### UI Flow
1. User selects a document from "My Documents"
2. Click "Read & Learn" to open the reader
3. Navigate through pages/chapters
4. Click "Explain This" to get AI explanation
5. Use voice or text to ask questions about the current content

---

## Task 3: Fix Study Reminder Notifications

**Root Cause Analysis**:
1. The push notifications rely on `sw.js` (service worker) but no `sw.js` file exists in the `public` folder
2. VitePWA generates a service worker, but it's named differently (`sw.js` vs generated name)
3. The notification permission might be blocked or the browser doesn't support it
4. The PWA service worker registration path may not match

### Files to Modify

**File: `src/hooks/usePushNotifications.ts`**
- Fix service worker registration to use the VitePWA generated worker
- Add better fallback for browsers without service worker support
- Improve error handling and user feedback
- Use `navigator.serviceWorker.ready` properly

**File: `vite.config.ts`**
- Ensure service worker filename is consistent
- Add explicit service worker scope configuration

### Key Fixes

```typescript
// In usePushNotifications.ts - fix SW registration
// VitePWA generates a service worker at /sw.js by default
// But we need to wait for it to be ready

// Current issue: trying to register '/sw.js' manually when VitePWA already handles this
// Fix: Use the existing registration from VitePWA

let registration = await navigator.serviceWorker.getRegistration('/');
if (!registration) {
  // Wait for VitePWA to register
  registration = await navigator.serviceWorker.ready;
}
```

### Additional Improvements
- Add debug logging to help diagnose notification issues
- Add a test notification on the settings page that shows browser-level support status
- Show clearer error messages when notifications fail

---

## Task 4: Google Analytics Implementation

**Goal**: Add Google Analytics tracking to all pages using the provided Measurement ID: G-385KRYXR2X

### File to Modify

**File: `index.html`**
Add the Google tag immediately after the `<head>` element:

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-385KRYXR2X"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-385KRYXR2X');
    </script>
    <meta charset="UTF-8" />
    <!-- rest of head content -->
  </head>
</html>
```

### Notes
- Single Page App (SPA) considerations: The current gtag.js setup will track initial page loads
- For route change tracking, React Router navigation is handled automatically by GA4's enhanced measurement
- No additional code changes needed since GA4 automatically tracks SPA navigation

---

## Task 5: Payment Callback Logo Replacement

**Goal**: Replace the icon-based logo on the payment cancellation page with text-based "TalkPDF AI" branding.

### File to Modify

**File: `src/pages/PaymentCallback.tsx`**

### Current Code (Lines 88-95)
```tsx
<Link to="/" className="inline-flex items-center gap-1.5 justify-center mb-6">
  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
    <span className="text-primary-foreground font-bold text-lg">T</span>
  </div>
  <span className="font-display text-2xl font-bold text-foreground tracking-tight">
    TalkPDF
  </span>
</Link>
```

### Updated Code
```tsx
<Link to="/" className="inline-flex items-center justify-center mb-6">
  <span className="font-display text-2xl font-bold text-foreground tracking-tight">
    TalkPDF AI
  </span>
</Link>
```

This removes the icon box with "T" and uses consistent text-only branding matching other pages.

---

## Implementation Order

1. **Phase 1 - Quick Fixes**
   - Task 4: Add Google Analytics (simple HTML change)
   - Task 5: Update PaymentCallback logo (simple UI change)

2. **Phase 2 - Notification Fix**
   - Task 3: Fix push notification service worker issues

3. **Phase 3 - AI Enhancements**
   - Task 1: Enhance chatbot with Nigerian academic context

4. **Phase 4 - New Feature**
   - Task 2: Implement page-by-page document reader (larger feature)

---

## Files Summary

| Task | File | Action |
|------|------|--------|
| 1 | `supabase/functions/support-chatbot/index.ts` | Update system prompt |
| 1 | `src/components/SupportChatbot.tsx` | Add knowledge base entries |
| 2 | `src/components/dashboard/DocumentReader.tsx` | Create new component |
| 2 | `src/pages/Dashboard.tsx` | Add reader tab/mode |
| 2 | `supabase/functions/process-pdf/index.ts` | Add section extraction |
| 3 | `src/hooks/usePushNotifications.ts` | Fix SW registration |
| 3 | `src/components/dashboard/NotificationSettings.tsx` | Improve diagnostics |
| 4 | `index.html` | Add Google Analytics script |
| 5 | `src/pages/PaymentCallback.tsx` | Update logo to text-only |

---

## Testing Checklist

- [ ] Verify Google Analytics tracking appears in GA4 dashboard
- [ ] Test PaymentCallback page shows "TalkPDF AI" text logo
- [ ] Test notification toggle in dashboard settings
- [ ] Test chatbot responds with Nigerian academic context
- [ ] Test page-by-page reading flow (once implemented)
