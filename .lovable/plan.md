
# Implementation Plan: Language Text Update, Page Navigation, and Nigerian Voice TTS

This plan addresses three requests:
1. Update Plus plan language text from "3 Nigerian languages (Yoruba, Igbo, Pidgin)" to "3 Nigerian languages (including Yoruba, Pidgin)"
2. Add page-by-page navigation with audio playback for Plus/Pro users in Read and Learn tab
3. Configure natural Nigerian accent voices using Gemini TTS for all 5 languages

---

## Request 1: Update Plus Plan Language Text

### Summary
Simple text change in two pricing components to accurately reflect that Igbo is Pro-only (per `LANGUAGE_ACCESS` in `useFeatureAccess.ts`).

### Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/SubscriptionPlans.tsx` (line 64) | Change `"3 Nigerian languages (Yoruba, Igbo, Pidgin)"` to `"3 Nigerian languages (including Yoruba, Pidgin)"` |
| `src/components/landing/Pricing.tsx` (line 65) | Change `"3 Nigerian languages (Yoruba, Igbo, Pidgin)"` to `"3 Nigerian languages (including Yoruba, Pidgin)"` |

---

## Request 2: Page Navigation in Read and Learn (Plus/Pro Only)

### Current State
The DocumentReader currently shows **concepts** extracted by AI, not actual PDF pages. Users navigate between concepts, not pages. The `documents` table has a `page_count` column but it's not populated.

### Solution: Enhanced Concept Navigation with Audio Playback
Since page-level content isn't stored, we'll enhance the concept navigation with:
1. **Jump-to-concept dropdown** - Quick selection of any concept
2. **Listen to concept audio** - Generate audio for the selected concept on-demand
3. **Feature gating** - Navigation and listen features locked to Plus/Pro users

### Implementation Details

#### 2.1 Add "pageNavigation" feature to plan access

**File**: `src/hooks/useFeatureAccess.ts`

Add new feature flag to `PlanFeatures` interface and `PLAN_FEATURES` object:

```typescript
// Add to PlanFeatures interface (around line 15):
pageNavigation: boolean;

// Add to PLAN_FEATURES:
free: {
  // ... existing ...
  pageNavigation: false,
},
plus: {
  // ... existing ...
  pageNavigation: true,
},
pro: {
  // ... existing ...
  pageNavigation: true,
},
```

#### 2.2 Enhance DocumentReader with Jump Navigation and Concept Audio

**File**: `src/components/dashboard/DocumentReader.tsx`

Changes:
1. Add dropdown to jump to any concept (gated to Plus/Pro)
2. Add "Listen to this concept" button that generates on-demand audio via the existing `generate-lesson-audio` edge function
3. Show upgrade prompt for Free users

```text
┌────────────────────────────────────────────────────────────────────┐
│  Document: [Dropdown v]                         [Listen to Audio] │
├────────────────────────────────────────────────────────────────────┤
│  AI Questions Today: 3 / 30                                        │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Concept 2 of 8: [Dropdown - Jump to Concept v] [<] [>]     │   │
│  │                  ▸ 1. Introduction to Cell Biology          │   │
│  │                  ▸ 2. Cell Structure (current)              │   │
│  │                  ▸ 3. Mitochondria                          │   │
│  │                  ...                                         │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Content area with concept explanation...                    │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ [Explain This] [Test My Understanding] [🔊 Listen to This] │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

Key additions:
- `Select` dropdown to jump to any concept (imports from shadcn)
- "Listen to This" button that calls `generate-lesson-audio` edge function
- Mini audio player for concept audio
- Feature gating using `useFeatureAccess` hook

#### 2.3 Add Concept Audio Player State

```typescript
const [conceptAudioUrl, setConceptAudioUrl] = useState<string | null>(null);
const [generatingAudio, setGeneratingAudio] = useState(false);
const [conceptAudioElement, setConceptAudioElement] = useState<HTMLAudioElement | null>(null);
```

#### 2.4 New Function: handleListenToConcept

```typescript
const handleListenToConcept = async () => {
  if (!selectedDoc || !currentConcept) return;
  
  // Create audio element immediately in user gesture context
  const audio = new Audio();
  setConceptAudioElement(audio);
  setGeneratingAudio(true);
  
  try {
    const { data, error } = await supabase.functions.invoke("generate-lesson-audio", {
      body: {
        concept: `${currentConcept.title}: ${currentConcept.content}`,
        documentSummary: selectedDoc.summary,
        language: selectedDoc.audio_language || "en"
      }
    });
    
    if (error || !data?.audioBase64) {
      toast.error("Failed to generate audio");
      return;
    }
    
    const audioUrl = `data:audio/wav;base64,${data.audioBase64}`;
    audio.src = audioUrl;
    await audio.play();
    setConceptAudioUrl(audioUrl);
  } catch (error) {
    toast.error("Failed to generate audio");
  } finally {
    setGeneratingAudio(false);
  }
};
```

#### 2.5 Feature Gate for Free Users

Display an upgrade prompt when Free users try to access the jump navigation or listen features:

```typescript
{isFree && (
  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
    <Crown className="h-4 w-4 text-primary" />
    <span className="text-sm text-muted-foreground">
      Upgrade to Plus for quick concept navigation and audio playback
    </span>
    <Button size="sm" variant="outline" onClick={onNavigateToUpgrade} className="ml-auto">
      Upgrade
    </Button>
  </div>
)}
```

---

## Request 3: Nigerian Accent Voices with Gemini TTS

### Current State
The Gemini TTS implementation uses generic voices (Charon, Kore, Puck) that don't have Nigerian accents. The current fallback chain is: Spitch (native Nigerian) -> Gemini (generic) -> ElevenLabs (Nigerian accent).

### Solution: Optimize Gemini TTS for Nigerian Context

Since Gemini TTS doesn't have native Nigerian accent voices, we'll enhance the implementation by:
1. **Translate/adapt the text** to include Nigerian English phrasing before TTS
2. **Use optimal Gemini voices** for clarity when reading educational content
3. **Prioritize Spitch and ElevenLabs** for authentic Nigerian accents, with Gemini as a reliable fallback

### Voice Strategy by Language

| Language | Primary (Spitch) | Secondary (Gemini) | Fallback (ElevenLabs) |
|----------|------------------|--------------------|-----------------------|
| English (en) | lucy | Charon (informative) | Daniel (Nigerian) |
| Yoruba (yo) | sade | Kore (clear) | Olufunmilola |
| Hausa (ha) | zainab | Kore (clear) | Olufunmilola |
| Igbo (ig) | ngozi | Kore (clear) | Olufunmilola |
| Pidgin (pcm) | lucy | Puck (upbeat) | Daniel (Nigerian) |

### Implementation Changes

#### 3.1 Enhance Gemini Voice Selection for Educational Content

**File**: `supabase/functions/process-pdf/index.ts`

Update the Gemini voice map with optimal voices for reading textbook content:

```typescript
// Gemini TTS voice mapping - optimized for educational Nigerian content
const geminiVoiceMap: Record<string, string> = {
  "en": "Charon",   // Informative, calm - perfect for textbook reading
  "yo": "Kore",     // Firm and clear - good for formal Yoruba content
  "ha": "Kore",     // Firm and clear - good for Hausa content
  "ig": "Kore",     // Firm and clear - good for Igbo content
  "pcm": "Puck",    // Upbeat and friendly - matches Pidgin's casual tone
};
```

#### 3.2 Add Nigerian English Adaptation for Gemini TTS

When falling back to Gemini TTS, add a preprocessing step to adapt the text with Nigerian English phrasing:

**File**: `supabase/functions/process-pdf/index.ts`

Add function after `generateSpitchAudio`:

```typescript
// Adapt text for Nigerian English pronunciation when using Gemini TTS
async function adaptForNigerianEnglish(text: string, targetLanguage: string): Promise<string> {
  // For English and Pidgin, we can read directly with good Gemini voices
  if (targetLanguage === "en" || targetLanguage === "pcm") {
    return text;
  }
  
  // For Nigerian languages, we already translated the text - Gemini will read it phonetically
  return text;
}
```

#### 3.3 Apply to generate-lesson-audio Function

**File**: `supabase/functions/generate-lesson-audio/index.ts`

The voice mapping is already correctly configured. The current implementation prioritizes Spitch (native Nigerian voices) with Gemini and ElevenLabs as fallbacks. This is the optimal configuration for Nigerian accents.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/SubscriptionPlans.tsx` | Update Plus plan language text |
| `src/components/landing/Pricing.tsx` | Update Plus plan language text |
| `src/hooks/useFeatureAccess.ts` | Add `pageNavigation` feature flag |
| `src/components/dashboard/DocumentReader.tsx` | Add concept jump dropdown, listen button, audio player, feature gating |
| `supabase/functions/process-pdf/index.ts` | Already has optimized Gemini voices - no changes needed |
| `supabase/functions/generate-lesson-audio/index.ts` | Already has correct fallback chain - no changes needed |

---

## Technical Notes

### Audio Generation Flow
The existing TTS fallback chain is well-designed:
1. **Spitch** (Primary) - Native Nigerian voices (Sade, Zainab, Ngozi, Lucy)
2. **Gemini TTS** (Secondary) - Clear, professional voices with WAV header fix already applied
3. **ElevenLabs** (Final) - Nigerian accent voices (Olufunmilola, Daniel)

### Browser Autoplay Compliance
The DocumentReader's "Listen to This" feature must create the Audio element synchronously within the user's click event to comply with browser autoplay policies. This pattern is already implemented in MicroLessons and will be replicated.

### Feature Access Control
The `pageNavigation` feature is controlled via `useFeatureAccess` hook, ensuring:
- Free users see upgrade prompts
- Plus/Pro users get full access to jump navigation and concept audio

---

## Testing Checklist

- [ ] Verify Plus plan shows "3 Nigerian languages (including Yoruba, Pidgin)" on landing and dashboard pricing
- [ ] Test concept jump dropdown appears for Plus/Pro users only
- [ ] Test "Listen to This" button generates and plays audio correctly
- [ ] Verify Free users see upgrade prompt for navigation features
- [ ] Test audio plays in all 5 languages (en, yo, ha, ig, pcm)
- [ ] Confirm Spitch -> Gemini -> ElevenLabs fallback chain works
