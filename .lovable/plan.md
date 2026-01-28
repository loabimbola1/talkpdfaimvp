

# Implementation Plan: 7 Feature Updates and Bug Fixes

## Overview
This plan addresses 7 items: audio language selection improvements, micro-lesson audio quality, performance optimization, pricing updates, caching issues, and admin notifications. Here's a detailed breakdown of each task.

---

## 1. Pre-Upload Audio Language Selection Prompt

**Current State**: Language selection exists in PDFUpload.tsx but is not prominently positioned as a required step before upload.

**Changes Required**:

**File: `src/components/dashboard/PDFUpload.tsx`**
- Add a visual step indicator showing "Step 1: Select Language → Step 2: Upload"
- Make language selection more prominent with a card-style UI
- Add validation to require explicit language selection before allowing file drop
- Keep the Nigerian accent as default (English with Nigerian accent via "idera" voice)

**Technical Approach**:
- Add a `hasSelectedLanguage` state initialized to `false`
- Show a language selection card before the dropzone is enabled
- Once language is selected, enable the dropzone
- Add clear messaging: "Select your preferred audio language first"

---

## 2. Nigerian-Accented Audio for "1 Minute Lessons"

**Current State**: The `generate-lesson-audio` edge function only generates text explanations, not audio. The MicroLessons component uses browser `speechSynthesis` which has generic voices.

**Changes Required**:

**File: `supabase/functions/generate-lesson-audio/index.ts`**
- Add TTS audio generation using YarnGPT/Spitch (same providers as process-pdf)
- Return base64-encoded audio in the response
- Use Nigerian accent voices ("idera" for English, native voices for other languages)

**File: `src/components/dashboard/MicroLessons.tsx`**
- Add language selection dropdown for micro-lessons
- Replace browser `speechSynthesis` with audio player using generated audio
- Store and cache generated audio in the database
- Add loading state while audio is being generated

**Technical Approach**:
- Import the YarnGPT voice mapping from process-pdf logic
- Generate audio server-side with the explanation text
- Return audio as base64 in the response
- Play using HTML5 Audio element on the frontend

---

## 3. Performance Optimization for Low-Spec Devices

**Current State**: The app loads all components eagerly, which can be heavy for devices with limited RAM (1GB).

**Changes Required**:

**File: `src/App.tsx`**
- Implement React.lazy() for route-based code splitting
- Add Suspense boundaries with lightweight loading fallbacks

**File: `src/pages/Index.tsx`**
- Lazy load heavy landing page sections (Pricing, Testimonials, Features)
- Defer non-critical third-party scripts

**File: `vite.config.ts`**
- Add build optimization: `build.rollupOptions.output.manualChunks` for vendor splitting
- Enable compression and minification optimizations

**File: `index.html`**
- Add `loading="lazy"` to images
- Add font-display: swap for web fonts
- Consider preconnect hints for Supabase

**Technical Approach**:
```typescript
// Example lazy loading pattern
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));

// In routes
<Suspense fallback={<PageLoader />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
  </Routes>
</Suspense>
```

---

## 4. Update Pro Subscription Pricing

**Current State**: 
- Landing page Pricing.tsx: Pro = ₦7,500/₦84,000 ✓ (correct)
- Dashboard SubscriptionPlans.tsx: Pro = ₦3,500/₦40,000 ✗ (WRONG - needs update)
- User request: Pro = ₦8,500/₦84,000 with "Save ₦18,000"

**Changes Required**:

**File: `src/components/landing/Pricing.tsx`**
- Update Pro monthly price from ₦7,500 to ₦8,500
- Add explicit savings indicators:
  - Plus annual: "Save ₦6,000" (₦3,500 × 12 = ₦42,000 - ₦36,000 = ₦6,000)
  - Pro annual: "Save ₦18,000" (₦8,500 × 12 = ₦102,000 - ₦84,000 = ₦18,000)

**File: `src/components/dashboard/SubscriptionPlans.tsx`**
- Update Plus monthly: ₦2,000 → ₦3,500
- Update Plus yearly: ₦20,000 → ₦36,000
- Update Pro monthly: ₦3,500 → ₦8,500
- Update Pro yearly: ₦40,000 → ₦84,000
- Add savings indicators matching landing page
- Ensure Plus includes "3 Nigerian languages (Yoruba, Igbo, Pidgin)"

**File: `supabase/functions/_shared/pricing.ts`**
- Update Pro monthly from 7500 to 8500

**File: `supabase/functions/support-chatbot/index.ts`**
- Update pricing reference in chatbot context

---

## 5. Fix Upgrade Button Pricing Consistency

**Current State**: Dashboard upgrade buttons, daily usage section, and settings still show old pricing.

**Changes Required**:

**File: `src/components/dashboard/SubscriptionPlans.tsx`**
- Completely align with landing page pricing
- Ensure Plus features include "3 Nigerian languages (Yoruba, Igbo, Pidgin)" not "2"

**File: `src/components/dashboard/UsageLimitsDisplay.tsx`**
- No pricing displayed here, but verify upgrade button works correctly

**File: `src/components/dashboard/SubscriptionStatus.tsx`**
- Verify upgrade button navigates correctly

**Technical Approach**:
- Create a shared pricing constant file for frontend consistency
- Reference the same prices across all components

---

## 6. Fix Data Caching Issues (Service Worker Cache)

**Current State**: Users see stale data after updates. Works in incognito (fresh cache). The current `main.tsx` clears localStorage but the service worker cache in `vite.config.ts` uses `StaleWhileRevalidate` and `CacheFirst` strategies that can serve stale data.

**Root Cause**: The PWA service worker caches API responses (`supabase-documents`, `supabase-api`) with long expiration (7 days for documents, 1 day for API). On update, stale cached responses are served.

**Changes Required**:

**File: `vite.config.ts`**
- Change `StaleWhileRevalidate` to `NetworkFirst` for documents API
- Reduce cache expiration for dynamic data
- Add cache versioning

**File: `src/main.tsx`**
- Increment APP_VERSION to "2.2.0" to trigger cache clear
- Add service worker cache clearing on version change
- Clear caches using `caches.delete()` API for service worker caches

**Technical Approach**:
```typescript
// In main.tsx, add service worker cache clearing
if (cachedVersion !== APP_VERSION) {
  // Clear service worker caches
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        if (cacheName.startsWith('supabase-')) {
          caches.delete(cacheName);
        }
      });
    });
  }
  // ... existing localStorage clearing
}
```

**File: `vite.config.ts`** (workbox configuration)
```typescript
runtimeCaching: [
  {
    urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/documents.*/i,
    handler: "NetworkFirst", // Changed from StaleWhileRevalidate
    options: {
      cacheName: "supabase-documents-v2", // Versioned cache name
      expiration: {
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 4 // 4 hours instead of 7 days
      },
      // ...
    }
  }
]
```

---

## 7. Admin Notification System for Suspicious Referrals

**Current State**: AdminReferralAnalytics.tsx shows suspicious referrals but doesn't notify admins proactively.

**Changes Required**:

**File: `supabase/functions/referral/index.ts`**
- Add logic to send notification to admins when a referral is flagged as suspicious
- Use Resend to send email notification to admin email addresses

**File: `src/components/dashboard/AdminReferralAnalytics.tsx`**
- Add a visual notification badge/counter at the top
- Add real-time subscription to referrals table for live updates
- Show toast notification when new suspicious referral is detected

**Database Migration**:
- Consider adding an `admin_notifications` table to track seen/unseen notifications
- Or use a simpler approach: badge count based on unflagged suspicious referrals

**Technical Approach**:
```typescript
// In referral edge function, after flagging suspicious
if (flaggedSuspicious) {
  // Send email to admin
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'TalkPDF AI <alerts@talkpdf.online>',
      to: ['admin@talkpdf.online'],
      subject: '⚠️ Suspicious Referral Detected',
      html: `<p>A suspicious referral was detected...</p>`
    })
  });
}
```

---

## Implementation Order

1. **Phase 1 - Quick Wins (Pricing & Caching)**
   - Fix pricing inconsistencies across all files
   - Fix service worker caching issues
   
2. **Phase 2 - Audio Improvements**
   - Add pre-upload language selection prompt
   - Update generate-lesson-audio with TTS
   
3. **Phase 3 - Performance**
   - Implement lazy loading
   - Add code splitting
   
4. **Phase 4 - Admin Features**
   - Add suspicious referral notifications

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/landing/Pricing.tsx` | Update Pro to ₦8,500, add savings indicators |
| `src/components/dashboard/SubscriptionPlans.tsx` | Sync all pricing, fix Plus languages |
| `supabase/functions/_shared/pricing.ts` | Update Pro from 7500 to 8500 |
| `supabase/functions/support-chatbot/index.ts` | Update pricing text |
| `src/main.tsx` | Increment version, add cache clearing |
| `vite.config.ts` | Change caching strategy, version caches |
| `src/components/dashboard/PDFUpload.tsx` | Add prominent language selection step |
| `supabase/functions/generate-lesson-audio/index.ts` | Add YarnGPT TTS audio generation |
| `src/components/dashboard/MicroLessons.tsx` | Replace speechSynthesis with audio player, add language selection |
| `src/App.tsx` | Add React.lazy() and Suspense |
| `supabase/functions/referral/index.ts` | Add admin email notification |
| `src/components/dashboard/AdminReferralAnalytics.tsx` | Add notification badge and real-time updates |

---

## Testing Checklist

- [ ] Verify Pro plan shows ₦8,500/month on landing page
- [ ] Verify "Save ₦18,000" appears for Pro annual billing
- [ ] Verify "Save ₦6,000" appears for Plus annual billing
- [ ] Verify Plus shows "3 Nigerian languages" in features
- [ ] Test PDF upload requires language selection first
- [ ] Test micro-lessons play Nigerian-accented audio
- [ ] Test site loads on 1GB RAM device
- [ ] Test data updates immediately after site changes (no stale data)
- [ ] Test admin receives email for suspicious referrals

