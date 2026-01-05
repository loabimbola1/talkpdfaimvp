import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessRequest {
  documentId: string;
  language?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { documentId, language = "en" }: ProcessRequest = await req.json();

    console.log("Processing document:", documentId, "Language:", language);

    // Get document details
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (docError || !document) {
      console.error("Document not found:", docError);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from("documents")
      .update({ status: "processing", audio_language: language })
      .eq("id", documentId);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from("talkpdf")
      .download(document.file_url);

    if (downloadError || !fileData) {
      console.error("Failed to download PDF:", downloadError);
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Failed to download PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract text from PDF using AI
    const pdfBase64 = await blobToBase64(fileData);
    
    console.log("Extracting text from PDF...");
    
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a document extraction assistant. Extract ALL text content from the provided PDF document. Preserve the structure and order of the content. Focus on extracting educational content, key concepts, and important information that students would need to learn. Output only the extracted text, no commentary."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text content from this PDF document. Include all educational content, definitions, concepts, and key points."
              },
              {
                type: "file",
                file: {
                  filename: document.file_name,
                  file_data: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 16000
      })
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error("AI extraction failed:", errorText);
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Failed to extract text from PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.choices?.[0]?.message?.content || "";

    console.log("Extracted text length:", extractedText.length);

    if (!extractedText || extractedText.length < 50) {
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Could not extract text from PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate summary and study prompts
    console.log("Generating summary and study prompts...");
    
    const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an educational content analyzer. Create a comprehensive summary and study prompts from the document content. 
            
Output a JSON object with this structure:
{
  "summary": "A comprehensive summary of the document (300-500 words)",
  "key_concepts": ["concept1", "concept2", ...],
  "study_prompts": [
    {"topic": "Topic name", "prompt": "Explain..."},
    ...
  ]
}

Create 3-5 study prompts that will help students test their understanding.`
          },
          {
            role: "user",
            content: `Analyze this document content and create a summary with study prompts:\n\n${extractedText.substring(0, 10000)}`
          }
        ],
        max_tokens: 4000
      })
    });

    let summary = extractedText.substring(0, 1000);
    let studyPrompts: Array<{topic: string; prompt: string}> = [];

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      const summaryContent = summaryData.choices?.[0]?.message?.content || "";
      
      try {
        const jsonMatch = summaryContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = parsed.summary || summary;
          studyPrompts = parsed.study_prompts || [];
        }
      } catch (e) {
        console.log("Could not parse summary JSON, using raw text");
        summary = summaryContent.substring(0, 1000);
      }
    }

    // Generate audio using ElevenLabs
    console.log("Generating audio...");
    
    // Truncate text for TTS (ElevenLabs has limits)
    const textForTts = extractedText.substring(0, 5000);
    
    // Map language to voice
    const voiceMap: Record<string, string> = {
      "en": "JBFqnCBsd6RMkjVDRZzb", // George
      "yo": "JBFqnCBsd6RMkjVDRZzb", // Default to English voice
      "ha": "JBFqnCBsd6RMkjVDRZzb",
      "ig": "JBFqnCBsd6RMkjVDRZzb",
      "pcm": "JBFqnCBsd6RMkjVDRZzb"
    };
    
    const voiceId = voiceMap[language] || voiceMap["en"];

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textForTts,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0
          }
        })
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("TTS failed:", errorText);
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Failed to generate audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    
    // Calculate approximate audio duration (rough estimate)
    const wordCount = textForTts.split(/\s+/).length;
    const audioDurationSeconds = Math.round(wordCount / 2.5); // ~150 words per minute

    // Upload audio to storage
    const audioPath = `${document.user_id}/${documentId}/audio.mp3`;
    
    const { error: uploadError } = await supabase
      .storage
      .from("talkpdf")
      .upload(audioPath, audioBlob, {
        contentType: "audio/mpeg",
        upsert: true
      });

    if (uploadError) {
      console.error("Failed to upload audio:", uploadError);
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Failed to save audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update document with all the generated content
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        summary: summary,
        study_prompts: studyPrompts,
        audio_url: audioPath,
        audio_duration_seconds: audioDurationSeconds,
        audio_language: language
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Failed to update document:", updateError);
    }

    // Track usage
    await supabase.from("usage_tracking").insert({
      user_id: document.user_id,
      action_type: "pdf_upload",
      metadata: { document_id: documentId }
    });

    await supabase.from("usage_tracking").insert({
      user_id: document.user_id,
      action_type: "audio_conversion",
      audio_minutes_used: audioDurationSeconds / 60,
      metadata: { document_id: documentId, language }
    });

    console.log("Document processed successfully:", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        summary: summary.substring(0, 200) + "...",
        studyPromptsCount: studyPrompts.length,
        audioDuration: audioDurationSeconds
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
