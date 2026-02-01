
# Implementation Plan: Fix TTS Provider Chain with Spitch and Gemini TTS

This plan replaces the unreliable YarnGPT with Spitch.app and implements proper Google Gemini TTS as a fallback, with ElevenLabs as the final fallback.

---

## Problem Analysis

### Current Issues

| Provider | Issue |
|----------|-------|
| **YarnGPT** | API endpoint `yarngpt.ai/api/v1/tts` appears to be non-functional or returning errors, causing fallback to ElevenLabs |
| **Lovable AI Gemini TTS** | Using incorrect API format - the Lovable AI Gateway doesn't support the `responseModalities: ["AUDIO"]` format that Gemini TTS requires |
| **ElevenLabs** | Works but Nigerian accent voices may not be as authentic as native Nigerian language providers |
| **Spitch** | Already implemented as standalone function but NOT integrated into main TTS fallback chain |

### Proposed TTS Fallback Chain

```text
+-----------+     +-----------+     +-------------+
|  Spitch   | --> | Gemini    | --> | ElevenLabs  |
|  (Primary)|     | TTS       |     | (Final)     |
+-----------+     +-----------+     +-------------+
     |                  |                  |
     v                  v                  v
  Nigerian          Google API         Olufunmilola/
  Native Voices     (Direct Call)      Daniel voices
```

---

## Task 1: Add GEMINI_API_KEY Secret

The user has provided a Google AI Studio API key. This needs to be added as a Supabase secret.

**Secret to Add:**
- Name: `GEMINI_API_KEY`
- Value: `AIzaSyA4pCKVeFMtZJPF_F-g1NK240e0CFoHjDY`

---

## Task 2: Update process-pdf/index.ts

### Changes Overview

1. **Remove YarnGPT** - Replace with Spitch API integration
2. **Add Spitch TTS function** - Inline implementation for Nigerian languages
3. **Implement proper Gemini TTS** - Using Google's direct API with correct format
4. **Remove broken Lovable AI Gemini fallbacks** - Lines 686-812

### Spitch Voice Mapping (Nigerian Languages)

```typescript
const spitchVoiceMap: Record<string, { voice: string; language: string }> = {
  "yo": { voice: "sade", language: "yo" },    // Yoruba
  "ha": { voice: "zainab", language: "ha" },  // Hausa
  "ig": { voice: "ngozi", language: "ig" },   // Igbo
  "en": { voice: "lucy", language: "en" },    // English
  "pcm": { voice: "lucy", language: "en" },   // Pidgin (uses English)
};
```

### Gemini TTS Implementation

According to Google's documentation, the correct API call is:

```typescript
async function generateGeminiTTSAudio(
  text: string,
  language: string = "en"
): Promise<ArrayBuffer | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    console.log("Gemini API key not configured");
    return null;
  }

  // Select appropriate voice based on language
  // Gemini voices: Kore (Firm), Puck (Upbeat), Charon (Informative), etc.
  const voiceMap: Record<string, string> = {
    "en": "Charon",     // Informative - good for educational content
    "yo": "Kore",       // Firm - clear pronunciation
    "ha": "Kore",
    "ig": "Kore",
    "pcm": "Puck",      // Upbeat - good for Pidgin
  };

  const voice = voiceMap[language] || "Charon";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: text.substring(0, 5000) }]
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice
                }
              }
            }
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini TTS error: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      console.warn("Gemini TTS: No audio data in response");
      return null;
    }

    // Gemini returns base64 PCM audio (24kHz, 16-bit, mono)
    // Decode base64 to ArrayBuffer
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  } catch (error) {
    console.error("Gemini TTS error:", error);
    return null;
  }
}
```

### Updated Fallback Flow in process-pdf

```typescript
// TRY 1: Spitch for Nigerian languages (primary for yo, ha, ig, pcm)
if (SPITCH_API_KEY && ["yo", "ha", "ig", "en", "pcm"].includes(language)) {
  const spitchConfig = spitchVoiceMap[language] || spitchVoiceMap["en"];
  // ... call Spitch API
}

// TRY 2: Gemini TTS (better quality, supports multiple languages)
if (!audioBuffer && GEMINI_API_KEY) {
  audioBuffer = await generateGeminiTTSAudio(ttsText, language);
  // ...
}

// TRY 3: ElevenLabs (final fallback with Olufunmilola/Daniel voices)
if (!audioBuffer && ELEVENLABS_API_KEY) {
  // ... existing ElevenLabs code
}
```

---

## Task 3: Update generate-lesson-audio/index.ts

Apply the same changes for micro-lesson audio generation:

1. **Replace YarnGPT with Spitch** as primary provider
2. **Add Gemini TTS** as second fallback
3. **Keep ElevenLabs** with Nigerian voices as final fallback

### Updated Fallback Chain

```typescript
// Try Spitch first for Nigerian accent
const spitchAudio = await generateSpitchAudio(explanation, language);
if (spitchAudio) {
  audioBase64 = base64Encode(spitchAudio);
  audioProvider = "spitch";
} else {
  // Try Gemini TTS
  const geminiAudio = await generateGeminiTTSAudio(explanation, language);
  if (geminiAudio) {
    audioBase64 = base64Encode(geminiAudio);
    audioProvider = "gemini";
  } else {
    // Fallback to ElevenLabs with Olufunmilola/Daniel
    const elevenAudio = await generateElevenLabsAudio(explanation, language);
    if (elevenAudio) {
      audioBase64 = base64Encode(elevenAudio);
      audioProvider = "elevenlabs";
    }
  }
}
```

---

## Task 4: Update elevenlabs-tts/index.ts (Minor)

No major changes needed - this is already correctly configured with Olufunmilola/Daniel voices from the previous update.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/process-pdf/index.ts` | Replace YarnGPT with Spitch, add Gemini TTS function, remove broken Lovable AI fallbacks |
| `supabase/functions/generate-lesson-audio/index.ts` | Replace YarnGPT with Spitch, add Gemini TTS as fallback |

---

## Technical Details

### Spitch API (docs.spitch.app)

```typescript
// Endpoint: https://api.spitch.app/v1/speech
// Method: POST
// Headers: Authorization: Bearer {API_KEY}
// Body: { language: "yo", voice: "sade", text: "...", format: "mp3" }
// Returns: audio/mpeg binary
```

### Gemini TTS API (Google AI Studio)

```typescript
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent
// Method: POST
// Headers: x-goog-api-key: {API_KEY}
// Body: { contents, generationConfig: { responseModalities: ["AUDIO"], speechConfig: {...} } }
// Returns: base64 PCM audio in inlineData.data (24kHz, 16-bit, mono)
```

### Audio Format Notes

- **Spitch**: Returns MP3 directly
- **Gemini**: Returns PCM audio (24kHz, 16-bit, mono) - needs WAV header or conversion
- **ElevenLabs**: Returns MP3

For Gemini PCM audio, we'll store it as WAV or convert to MP3 for consistency.

---

## Spitch Voice Options

| Language | Voice | Description |
|----------|-------|-------------|
| Yoruba (yo) | sade, segun | Feminine/Masculine, energetic |
| Hausa (ha) | zainab, hassan | Feminine/Masculine, clear |
| Igbo (ig) | ngozi, emeka | Feminine/Masculine, soft |
| English (en) | lucy | Feminine, very clear |

---

## Gemini TTS Voice Options

| Voice | Style | Best For |
|-------|-------|----------|
| Charon | Informative | Educational content |
| Kore | Firm | Clear pronunciation |
| Puck | Upbeat | Conversational content |
| Aoede | Breezy | Casual content |
| Achird | Friendly | Welcoming content |

---

## Testing Checklist

After implementation, verify:
- [ ] Upload a PDF with Yoruba language selected - audio should use Spitch "sade" voice
- [ ] If Spitch fails, Gemini TTS should generate audio
- [ ] If both fail, ElevenLabs should use Olufunmilola voice
- [ ] Micro-lessons also use the same fallback chain
- [ ] TTS metadata correctly records which provider was used
- [ ] Check edge function logs for any API errors
