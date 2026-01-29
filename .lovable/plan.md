
# Implementation Plan: 6 Tasks

## Summary
Based on my analysis, I need to address:
1. Test leaderboard functionality (already using secure views - functioning correctly)
2. Add rate limiting to edge functions missing it
3. Frontend deployment issue (user needs to publish)
4. Test admin dashboard 
5. Fix Word document processing error
6. Remove "7-day free trial" text

---

## Task 1: Leaderboard Security Testing

**Status**: Already working correctly with secure views

The leaderboard components are correctly using secure database views:
- `ReferralLeaderboard.tsx` queries `leaderboard_profiles` view
- `QuizLeaderboard.tsx` queries `leaderboard_quiz_scores` view  
- `Leaderboard.tsx` queries `leaderboard_badges` view

The views use `security_invoker = true` and only expose: `user_id`, `full_name`, `university`, `referral_credits`, and scores. No PII (emails, avatars) is exposed.

From the network logs, I can see that when authenticated, the request to `leaderboard_profiles` succeeds (Status 200), and when the session expired it returned 401 (correctly blocking anonymous access).

**No code changes needed** - the system is working as designed.

---

## Task 2: Add Rate Limiting to Edge Functions

**Current State Analysis**:

Functions WITH rate limiting:
- `process-pdf` - 5 requests/minute
- `contact-form` - 5 requests/hour
- `explain-back-evaluate` - has rate limiting
- `generate-quiz` - has rate limiting
- `voice-to-text` - has rate limiting  
- `support-chatbot` - 20 requests/minute
- `generate-lesson-audio` - has rate limiting
- `spitch-tts` - has rate limiting
- `elevenlabs-tts` - has rate limiting

Functions MISSING rate limiting:
- `flutterwave-payment` - needs rate limiting
- `flutterwave-verify` - needs rate limiting
- `send-payment-email` - internal only, skip
- `admin-dashboard-data` - needs rate limiting
- `verify-admin` - needs rate limiting
- `weekly-digest` - scheduled/internal, skip
- `referral-notification` - internal only, skip
- `referral` - needs rate limiting

**Changes Required**:

### File: `supabase/functions/flutterwave-payment/index.ts`
- Import rate limiter from shared module
- Add rate limit: 5 payment attempts per minute per user
- Return 429 if exceeded

### File: `supabase/functions/flutterwave-verify/index.ts`
- Import rate limiter from shared module
- Add rate limit: 10 verifications per minute per user
- Return 429 if exceeded

### File: `supabase/functions/admin-dashboard-data/index.ts`
- Import rate limiter from shared module
- Add rate limit: 30 requests per minute per admin
- Return 429 if exceeded

### File: `supabase/functions/verify-admin/index.ts`
- Import rate limiter from shared module
- Add rate limit: 30 requests per minute per user
- Return 429 if exceeded

### File: `supabase/functions/referral/index.ts`
- Import rate limiter from shared module
- Add rate limit: 10 referral operations per minute per user
- Return 429 if exceeded

---

## Task 3: Frontend Deployment Issue

**Root Cause**: The user is seeing the preview updates but not the live site because frontend changes require clicking "Update" in the publish dialog.

**Solution**: Inform user to publish the changes - no code changes needed.

**User Action Required**: 
- Click the Publish button in the top right corner of the editor
- Click "Update" to push changes to the live domain (talkpdf.online)

---

## Task 4: Admin Dashboard Testing

**Status**: Already implemented with server-side authorization via `admin-dashboard-data` edge function.

The admin dashboard now:
1. Calls `supabase.functions.invoke('admin-dashboard-data')`
2. The edge function validates the JWT token
3. Checks `user_roles` table for admin role
4. Returns data only if admin verified

**Admin Access**:
- Email: lukmanabimb@gmail.com
- URL: /admin (requires login first at /auth)

---

## Task 5: Fix Word Document Processing Error

**Root Cause** (from edge function logs):
```
AI extraction failed: {"error":{"message":"Invalid file type: application/vnd.openxmlformats-officedocument.wordprocessingml.document","code":400...
```

The Lovable AI Gateway (Gemini) is rejecting the Word document MIME type. The current implementation sends Word documents using the `file` content type which the AI API doesn't support for Word files.

**Solution**: Convert Word document to text using a different approach before sending to AI for summarization.

**Changes Required**:

### File: `supabase/functions/process-pdf/index.ts`
For Word documents, use a text extraction library or convert the Word document differently:

```typescript
// Option 1: Use Gemini with explicit text extraction prompt
// Option 2: Use a Word document parser library

// The issue is that gemini-2.5-flash may not natively support .docx files
// Need to extract text from Word document before sending to AI

// Add mammoth.js for Word document extraction
import * as mammoth from "https://esm.sh/mammoth@1.6.0";
```

However, `mammoth` requires Node.js filesystem APIs not available in Deno. 

**Alternative Solution**: Use Google's Gemini file API differently or convert to PDF first.

**Recommended Approach**:
1. For Word documents, use a different API call format
2. Or inform the user that only PDF files are supported
3. Or use a web service to convert DOCX to text

**Technical Details**:
- The current code correctly detects Word documents
- The issue is the AI gateway doesn't accept DOCX as a file attachment
- We need to extract text from DOCX before sending to AI

### Implementation:
Add DOCX text extraction using a Deno-compatible library or fetch from a conversion service.

---

## Task 6: Remove "7-day Free Trial" Text

**Files to Modify**:

### File: `src/components/landing/Pricing.tsx`
- Remove line 373-375: "All plans include a 7-day free trial. Cancel anytime. No hidden fees."

### File: `src/components/SupportChatbot.tsx`
- Line 28: Remove "All paid plans include a 7-day free trial!" from the pricing answer

### File: `src/pages/FAQ.tsx`
- Line 51: Update answer to remove 7-day trial mention

---

## Implementation Order

1. **Phase 1 - Quick Text Removal** (Task 6)
   - Remove 7-day trial text from 3 files
   
2. **Phase 2 - Rate Limiting** (Task 2)
   - Add rate limiting to 5 edge functions
   
3. **Phase 3 - Word Document Fix** (Task 5)
   - Implement DOCX text extraction workaround

4. **Phase 4 - User Actions** (Tasks 3, 4)
   - User publishes to deploy frontend changes
   - User tests admin dashboard at /admin

---

## Technical Details

### Rate Limiter Import Pattern
```typescript
import { checkRateLimit, cleanupRateLimits, rateLimitResponse } from "../_shared/rate-limiter.ts";

// At start of handler:
cleanupRateLimits();

// After auth:
const rateLimit = checkRateLimit(userId, "function-name", { windowMs: 60000, maxRequests: 5 });
if (!rateLimit.allowed) {
  return rateLimitResponse(rateLimit.resetIn, corsHeaders);
}
```

### Word Document Fix Options
1. **Best**: Use a DOCX parsing library that works in Deno
2. **Alternative**: Send the raw text to AI for summarization without file attachment
3. **Fallback**: Inform users to convert to PDF before upload

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/landing/Pricing.tsx` | Remove 7-day trial text |
| `src/components/SupportChatbot.tsx` | Remove 7-day trial mention |
| `src/pages/FAQ.tsx` | Update FAQ answer |
| `supabase/functions/flutterwave-payment/index.ts` | Add rate limiting |
| `supabase/functions/flutterwave-verify/index.ts` | Add rate limiting |
| `supabase/functions/admin-dashboard-data/index.ts` | Add rate limiting |
| `supabase/functions/verify-admin/index.ts` | Add rate limiting |
| `supabase/functions/referral/index.ts` | Add rate limiting |
| `supabase/functions/process-pdf/index.ts` | Fix Word document handling |

---

## Testing Checklist

- [ ] Verify trial text removed from pricing page
- [ ] Verify trial text removed from chatbot responses
- [ ] Verify trial text removed from FAQ
- [ ] Test rate limiting on payment functions
- [ ] Test Word document upload after fix
- [ ] Verify admin dashboard loads data correctly
- [ ] User publishes and verifies live site updates
