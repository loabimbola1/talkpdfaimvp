
# Implementation Plan: Fix Three Critical Issues

This plan addresses three user-reported issues: stale browser cache, incorrect current plan display, and Yoruba voice quality.

---

## Issue Summary

| Issue | Root Cause | Solution |
|-------|------------|----------|
| 1. Stale Browser Cache | Old version cached in Chrome | Bump APP_VERSION to force cache invalidation |
| 2. Wrong "Current Plan" Display | `currentPlan` prop not passed to `SubscriptionPlans` | Fetch and pass user's actual plan from profile |
| 3. Poor Yoruba Voice Quality | Using generic ElevenLabs voices | Use "Olufunmilola" Nigerian accent voice (9Dbo4hEvXQ5l7MXGZFQA) |

---

## Task 1: Fix Stale Browser Cache

### Problem
The user's laptop Chrome is showing an outdated version with old plan names ("Student Pro", "Mastery Pass") and old pricing (N2,000). The current version has "Plus", "Pro" and updated pricing, but the browser cache is serving stale assets.

### Solution
Increment `APP_VERSION` in `src/main.tsx` to force cache invalidation on next page load.

### Changes
**File: `src/main.tsx`**
- Change `APP_VERSION` from `"2.2.0"` to `"2.3.0"`

---

## Task 2: Fix Incorrect "Current Plan" Display

### Problem
Looking at the second screenshot, the user is clearly on a Plus plan (the right sidebar shows "Plus Plan" with "150 base credits", "55 used", "100 remaining"). However, the "Current Plan" button appears on the Free tier card, not the Plus tier.

### Root Cause
In `Dashboard.tsx` line 338, the `SubscriptionPlans` component is rendered without passing the `currentPlan` prop:
```tsx
{activeTab === "subscription" && <SubscriptionPlans />}
```

The component defaults to `currentPlan = "free"` when no prop is provided. The component needs to fetch the user's actual subscription plan.

### Solution
Modify `SubscriptionPlans.tsx` to:
1. Use the `useFeatureAccess` hook to get the user's current plan
2. Ignore the prop and use the fetched plan instead (or remove the prop entirely)

### Changes
**File: `src/components/dashboard/SubscriptionPlans.tsx`**

```typescript
// Add import
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

// Inside component, before useState declarations
const { plan: userPlan, loading: planLoading } = useFeatureAccess();

// Use userPlan instead of currentPlan prop throughout
const isCurrentPlan = plan.planId === userPlan;
```

---

## Task 3: Improve Yoruba Voice with Nigerian Accent

### Problem
Users complain the Yoruba voice sounds "funny, inconsistent, and lacking authentic Nigerian accent." The user has specifically requested using the ElevenLabs voice "Olufunmilola - African Female with Nigerian Accent" (Voice ID: `9Dbo4hEvXQ5l7MXGZFQA`).

### Current State
- **process-pdf**: Uses YarnGPT as primary (`yoruba_female2`), ElevenLabs fallback uses `Daniel` voice (`onwK4e9ZLuTAKqWW03F9`)
- **elevenlabs-tts**: Uses `Sarah` voice (`EXAVITQu4vr4xnSDxMaL`) for all languages
- **generate-lesson-audio**: Uses YarnGPT primary, ElevenLabs fallback uses `George` voice (`JBFqnCBsd6RMkjVDRZzb`)

### Solution
Update ElevenLabs voice mappings in all three TTS edge functions to use Olufunmilola (9Dbo4hEvXQ5l7MXGZFQA) for Yoruba specifically, and consider Nigerian accent voices for other languages.

### Voice Configuration (ElevenLabs)
| Language | Current Voice | New Voice |
|----------|---------------|-----------|
| Yoruba (yo) | Sarah/Daniel/George | **Olufunmilola** (9Dbo4hEvXQ5l7MXGZFQA) |
| English (en) | Various | Keep Daniel (onwK4e9ZLuTAKqWW03F9) for Nigerian accent |
| Igbo (ig) | Sarah/Daniel | Olufunmilola (9Dbo4hEvXQ5l7MXGZFQA) |
| Hausa (ha) | Sarah/Daniel | Olufunmilola (9Dbo4hEvXQ5l7MXGZFQA) |
| Pidgin (pcm) | Sarah/Daniel | Keep Daniel (Nigerian accent) |

### Changes

**File: `supabase/functions/elevenlabs-tts/index.ts`**
```typescript
const voiceMapping: Record<string, string> = {
  en: "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent
  yo: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  ha: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  ig: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  pcm: "onwK4e9ZLuTAKqWW03F9", // Daniel - Nigerian accent for Pidgin
};
```

**File: `supabase/functions/process-pdf/index.ts`** (lines 54-62)
```typescript
const elevenLabsVoiceMap: Record<string, string> = {
  "en": "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent
  "yo": "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  "ha": "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  "ig": "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  "pcm": "onwK4e9ZLuTAKqWW03F9", // Daniel - Nigerian accent for Pidgin
};
```

**File: `supabase/functions/generate-lesson-audio/index.ts`** (lines 91-100)
```typescript
async function generateElevenLabsAudio(text: string, language: string = "en"): Promise<ArrayBuffer | null> {
  // ...
  
  // Voice mapping for Nigerian languages
  const voiceMap: Record<string, string> = {
    en: "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent
    yo: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
    ha: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola
    ig: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola
    pcm: "onwK4e9ZLuTAKqWW03F9", // Daniel
  };
  
  const voiceId = voiceMap[language] || voiceMap["en"];
  // ... rest of function
}
```

Also update the function signature to accept language parameter:
```typescript
// Update call site
const elevenAudio = await generateElevenLabsAudio(explanation, language);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/main.tsx` | Bump APP_VERSION to "2.3.0" |
| `src/components/dashboard/SubscriptionPlans.tsx` | Add useFeatureAccess hook to fetch actual user plan |
| `supabase/functions/elevenlabs-tts/index.ts` | Update voice mapping to use Olufunmilola |
| `supabase/functions/process-pdf/index.ts` | Update elevenLabsVoiceMap |
| `supabase/functions/generate-lesson-audio/index.ts` | Update ElevenLabs voice mapping and pass language param |

---

## Technical Details

### Olufunmilola Voice (9Dbo4hEvXQ5l7MXGZFQA)
- **Name**: Olufunmilola - African Female with Nigerian Accent
- **Provider**: ElevenLabs
- **Use Case**: Best for Yoruba and other Nigerian language content
- **Model**: Works with `eleven_multilingual_v2`

### Voice Settings (Recommended)
```json
{
  "stability": 0.5,
  "similarity_boost": 0.75,
  "style": 0.3,
  "use_speaker_boost": true
}
```

---

## Testing Checklist

After implementation, verify:
- [ ] Clear browser cache and confirm new version loads (v2.3.0)
- [ ] Login as a Plus plan user and verify "Current Plan" shows on Plus tier
- [ ] Generate Yoruba audio and verify it uses Nigerian accent voice
- [ ] Test micro-lessons with Nigerian language selection
- [ ] Verify YarnGPT still works as primary TTS (Olufunmilola is fallback only)
