
# Implementation Plan: Atlas.org-Style UX Redesign & Audio Playback Fixes

This plan addresses two critical issues: (1) redesigning the website UX to mimic atlas.org's solution-focused style, and (2) fixing the silent/empty audio in Listen Mode and micro-lessons.

---

## Issue Summary

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Silent/Empty Audio | Gemini TTS returns raw PCM without WAV header; Spitch is returning 530 errors | Add proper WAV header to Gemini PCM audio; fix browser audio playback timing |
| Micro-lesson Audio Fails | Audio element created after async operations, breaking user gesture context | Create Audio element synchronously before async calls |
| UX/UI Redesign | Current design lacks the clean, solution-focused style of atlas.org | Redesign landing page with minimalist hero, problem-solution focus, and social proof |

---

## Part 1: Fix Audio Generation & Playback Issues

### Issue 1.1: Gemini TTS Audio Format (Critical)

**Problem**: Looking at the edge function logs:
```
Spitch error: 530 <!doctype html>...
Gemini TTS: Successfully generated audio, size: 2719246 bytes
```

Spitch is returning 530 errors (Cloudflare blocking), so Gemini TTS is being used as fallback. However, **Gemini returns raw PCM audio (24kHz, 16-bit, mono) without a WAV header**. The code saves it as `.wav` but without the header, browsers cannot play it correctly - resulting in silence.

**Solution**: Add a WAV header to the raw PCM data before storing.

**Files to modify**:
- `supabase/functions/process-pdf/index.ts` (lines 260-274, 807-829)
- `supabase/functions/generate-lesson-audio/index.ts` (lines 140-148)

**Implementation**:
```typescript
// Add WAV header helper function
function addWavHeader(pcmBuffer: ArrayBuffer, sampleRate: number = 24000, channels: number = 1, bitsPerSample: number = 16): ArrayBuffer {
  const pcmData = new Uint8Array(pcmBuffer);
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  
  // RIFF header
  view.setUint32(0, 0x52494646, false);  // "RIFF"
  view.setUint32(4, 36 + pcmData.length, true);  // File size
  view.setUint32(8, 0x57415645, false);  // "WAVE"
  
  // fmt chunk
  view.setUint32(12, 0x666D7420, false);  // "fmt "
  view.setUint32(16, 16, true);  // Chunk size
  view.setUint16(20, 1, true);   // Audio format (PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  view.setUint32(36, 0x64617461, false);  // "data"
  view.setUint32(40, pcmData.length, true);
  
  // Combine header and PCM data
  const result = new Uint8Array(44 + pcmData.length);
  result.set(new Uint8Array(wavHeader), 0);
  result.set(pcmData, 44);
  
  return result.buffer;
}
```

Then update the Gemini TTS audio handling:
```typescript
// In generateGeminiTTSAudio function - wrap PCM with WAV header
const wavBuffer = addWavHeader(bytes.buffer, 24000, 1, 16);
console.log(`Gemini TTS: Successfully generated WAV audio, size: ${wavBuffer.byteLength} bytes`);
return wavBuffer;
```

---

### Issue 1.2: Micro-Lesson Audio Playback (Browser Policy)

**Problem**: The `playGeneratedAudio` function in `MicroLessons.tsx` creates the Audio element AFTER async operations complete, breaking the browser's user gesture context requirement.

**Current Code** (lines 232-247):
```typescript
const playGeneratedAudio = (audioUrl: string) => {
  if (audioElement) {
    audioElement.pause();
  }
  const audio = new Audio(audioUrl);  // Created after async
  // ...
  audio.play();  // Fails - no user gesture context
};
```

**Solution**: Create Audio element synchronously BEFORE async operations in `startLesson`:

**File to modify**: `src/components/dashboard/MicroLessons.tsx`

```typescript
const startLesson = async (lesson: MicroLesson) => {
  setActiveLesson(lesson);
  setTimeRemaining(60);
  setExplanation("");
  
  // Create Audio element IMMEDIATELY within user gesture
  const audio = new Audio();
  audio.preload = "auto";
  setAudioElement(audio);
  
  // Update lesson status
  setLessons((prev) =>
    prev.map((l) =>
      l.id === lesson.id ? { ...l, status: "in_progress" as const } : l
    )
  );

  // Generate AI explanation - audio URL will be set on pre-existing element
  await generateAIExplanation(lesson, audio);
  
  setIsRunning(true);
};

// Updated function signature
const generateAIExplanation = async (lesson: MicroLesson, preCreatedAudio: HTMLAudioElement) => {
  // ... existing code ...
  
  if (data.audioBase64) {
    const audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
    // Set source on pre-existing element and play
    preCreatedAudio.src = audioUrl;
    preCreatedAudio.onended = () => setIsPlayingAudio(false);
    preCreatedAudio.onerror = () => {
      setIsPlayingAudio(false);
      toast.error("Failed to play audio");
    };
    await preCreatedAudio.play();
    setIsPlayingAudio(true);
  }
};
```

---

### Issue 1.3: generate-lesson-audio Gemini TTS Format

Apply the same WAV header fix to `generate-lesson-audio/index.ts`:

**File to modify**: `supabase/functions/generate-lesson-audio/index.ts` (lines 86-153)

Add the `addWavHeader` function and update `generateGeminiTTSAudio` to return proper WAV format.

---

## Part 2: Atlas.org-Style UX Redesign

Atlas.org uses a clean, solution-focused design with:
- **Minimalist hero** with bold problem statement
- **Problem-Solution structure** - clearly articulating the pain point before showing the solution
- **Social proof** prominently displayed
- **Clean typography** with generous whitespace
- **Focused CTAs** - single primary action
- **Trust indicators** (logos, numbers, testimonials)

### Design Changes

#### 2.1 Hero Section Redesign

**File**: `src/components/landing/Hero.tsx`

**Current**: Feature-focused ("Turn Your PDFs Into Interactive Audio Tutors")
**New**: Problem-focused first, then solution

```tsx
// New Hero structure
<section className="relative pt-28 pb-20 md:pt-40 md:pb-32">
  <div className="container mx-auto px-4">
    <div className="max-w-4xl mx-auto text-center">
      {/* Problem Statement */}
      <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.1]">
        Stop Reading.<br />
        <span className="text-muted-foreground">Start Understanding.</span>
      </h1>
      
      {/* Solution */}
      <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12">
        Turn any PDF into an audio tutor that speaks your language. 
        Learn in Yoruba, Hausa, Igbo, Pidgin, or English.
      </p>
      
      {/* Single Focused CTA */}
      <Button size="lg" className="h-14 px-10 text-lg rounded-full">
        Start Learning Free
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      
      {/* Immediate Trust */}
      <p className="mt-6 text-sm text-muted-foreground">
        Join 10,000+ students • No credit card required
      </p>
    </div>
  </div>
</section>
```

#### 2.2 Problem-Solution Section (New)

**New File**: `src/components/landing/ProblemSolution.tsx`

```tsx
const problems = [
  {
    problem: "Reading textbooks for hours",
    solution: "Listen while commuting, exercising, or relaxing",
    icon: Headphones
  },
  {
    problem: "English-only learning materials",
    solution: "Learn in Yoruba, Hausa, Igbo, or Pidgin",
    icon: Languages
  },
  {
    problem: "Memorizing without understanding",
    solution: "Explain-Back Mode proves you truly get it",
    icon: Brain
  }
];
```

#### 2.3 Simplified Features Section

**File**: `src/components/landing/Features.tsx`

Reduce to 3-4 core features with larger cards and more visual impact:
- Audio Learning (with waveform visual)
- 5 Nigerian Languages (with flag icons)
- Explain-Back Mode (with brain icon)
- Badges & Progress (with trophy visual)

#### 2.4 Social Proof Enhancement

**File**: `src/components/landing/TrustedBy.tsx`

Add university logos and real numbers:
```tsx
// Stats with larger numbers
<div className="grid grid-cols-3 gap-8 text-center">
  <div>
    <span className="text-5xl font-bold">10K+</span>
    <span className="text-muted-foreground">Students</span>
  </div>
  <div>
    <span className="text-5xl font-bold">50K+</span>
    <span className="text-muted-foreground">Hours Listened</span>
  </div>
  <div>
    <span className="text-5xl font-bold">4.9</span>
    <span className="text-muted-foreground">Rating</span>
  </div>
</div>
```

#### 2.5 Testimonials with Photos

**File**: `src/components/landing/Testimonials.tsx`

Add avatar placeholders and make quotes larger:
```tsx
// Larger, more prominent testimonial cards
<div className="grid md:grid-cols-3 gap-8">
  {testimonials.map((t) => (
    <div className="p-8 bg-card rounded-3xl border shadow-lg">
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="h-14 w-14">
          <AvatarFallback>{t.author[0]}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{t.author}</p>
          <p className="text-sm text-muted-foreground">{t.role}</p>
        </div>
      </div>
      <blockquote className="text-lg leading-relaxed">
        "{t.quote}"
      </blockquote>
    </div>
  ))}
</div>
```

#### 2.6 Color & Typography Refinements

**File**: `src/index.css`

Adjust for cleaner look:
```css
:root {
  /* Slightly softer primary for atlas-like feel */
  --primary: 210 100% 50%;  /* Brighter blue */
  
  /* Larger radius for friendlier feel */
  --radius: 1rem;
}

/* Increase heading line height */
h1, h2, h3 {
  line-height: 1.1;
}
```

---

## Files to Modify

### Audio Fixes
| File | Changes |
|------|---------|
| `supabase/functions/process-pdf/index.ts` | Add `addWavHeader` function; wrap Gemini PCM with WAV header |
| `supabase/functions/generate-lesson-audio/index.ts` | Add `addWavHeader` function; wrap Gemini PCM with WAV header |
| `src/components/dashboard/MicroLessons.tsx` | Create Audio element before async operations; restructure playback logic |

### UX Redesign
| File | Changes |
|------|---------|
| `src/components/landing/Hero.tsx` | Problem-focused headline, simplified CTA, trust indicators |
| `src/components/landing/Features.tsx` | Reduce to 4 core features with larger cards |
| `src/components/landing/HowItWorks.tsx` | Simplify steps, add visual connection |
| `src/components/landing/Testimonials.tsx` | Add avatars, larger quotes |
| `src/components/landing/TrustedBy.tsx` | Add large stat numbers, university logos |
| `src/components/landing/ProblemSolution.tsx` | NEW - Problem/solution comparison section |
| `src/pages/Index.tsx` | Add new ProblemSolution component |
| `src/index.css` | Typography and color refinements |

---

## Technical Details

### WAV Header Format (Gemini TTS)
- Sample Rate: 24000 Hz
- Channels: 1 (mono)
- Bits per Sample: 16
- Header Size: 44 bytes
- Chunk Size: 44 + PCM data length

### Browser Audio Policy
Modern browsers require audio playback to be initiated from a user gesture. The solution is to:
1. Create the `Audio` element synchronously in the click handler
2. Perform async operations (API calls)
3. Set the `src` property on the pre-existing element
4. Call `play()` - this works because the element was created in the gesture context

---

## Testing Checklist

### Audio Fixes
- [ ] Upload a PDF with Yoruba language and verify audio plays (not silent)
- [ ] Check edge function logs to confirm WAV header is being added
- [ ] Test micro-lesson audio playback - should auto-play after explanation generates
- [ ] Test on Chrome, Safari, and Firefox
- [ ] Test on mobile devices

### UX Redesign
- [ ] Verify hero section displays correctly on mobile and desktop
- [ ] Check all CTAs lead to correct destinations
- [ ] Verify dark mode compatibility
- [ ] Test responsive behavior at all breakpoints
- [ ] Verify animations are smooth and not jarring
