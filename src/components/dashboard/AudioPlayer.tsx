import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Headphones,
  Languages,
  FileText,
  Brain,
  Lightbulb,
  Download,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useOfflineAudio } from "@/hooks/useOfflineAudio";

// Poll for document completion after background processing
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max polling

interface NigerianLanguage {
  code: string;
  name: string;
  nativeName: string;
}

const nigerianLanguages: NigerianLanguage[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
  { code: "ig", name: "Igbo", nativeName: "Igbo" },
  { code: "pcm", name: "Nigerian Pidgin", nativeName: "Naija" },
];

interface Document {
  id: string;
  title: string;
  audio_url: string | null;
  audio_language: string | null;
  audio_duration_seconds: number | null;
  study_prompts?: Array<{ topic: string; prompt: string }> | null;
  status: string | null;
}

interface AudioPlayerProps {
  selectedDocumentId?: string | null;
  onExplainBackTrigger?: (documentId: string, promptIndex: number) => void;
}

const AudioPlayer = ({ selectedDocumentId: propDocumentId, onExplainBackTrigger }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [usingBrowserTTS, setUsingBrowserTTS] = useState(false);
  const [browserTTSPlaying, setBrowserTTSPlaying] = useState(false);
  const [pollingDocId, setPollingDocId] = useState<string | null>(null);
  
  // Offline audio hook
  const {
    isDownloading,
    downloadForOffline,
    removeOfflineAudio,
    isAudioCached,
    getOfflineAudioUrl,
  } = useOfflineAudio();
  
  // Auto-pause state
  const [autoPauseEnabled, setAutoPauseEnabled] = useState(true);
  const [pausePoints, setPausePoints] = useState<number[]>([]);
  const [currentPauseIndex, setCurrentPauseIndex] = useState(0);
  const [showExplainPrompt, setShowExplainPrompt] = useState(false);
  const [currentPromptForPause, setCurrentPromptForPause] = useState<{topic: string; prompt: string} | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastCheckedTimeRef = useRef(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    // Recover stale documents first, then fetch
    recoverStaleDocuments().then(() => fetchDocumentsWithAudio());
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  // Recover stale "processing" documents (stuck for >10 minutes)
  const recoverStaleDocuments = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: staleDocs } = await supabase
        .from("documents")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "processing")
        .lt("updated_at", tenMinutesAgo);

      if (staleDocs && staleDocs.length > 0) {
        console.log(`Recovering ${staleDocs.length} stale processing documents`);
        for (const doc of staleDocs) {
          await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
        }
      }
    } catch (err) {
      console.error("Stale doc recovery error:", err);
    }
  }, []);

  // Poll for document completion
  const pollForCompletion = useCallback(async (docId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("documents")
        .select("id, status, audio_url")
        .eq("id", docId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Poll error:", error);
        setPollingDocId(null);
        return;
      }

      if (data.status === "ready") {
        setPollingDocId(null);
        pollCountRef.current = 0;
        await fetchDocumentsWithAudio();
        if (data.audio_url) {
          toast.success("Audio generated successfully!");
        } else {
          toast.info("Document processed. Audio could not be generated — you can use browser voice instead.");
        }
        return;
      }

      if (data.status === "error") {
        setPollingDocId(null);
        pollCountRef.current = 0;
        toast.error("Audio generation failed. Try again or use browser voice.");
        await fetchDocumentsWithAudio();
        return;
      }

      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        setPollingDocId(null);
        pollCountRef.current = 0;
        // Mark as error so user can retry
        await supabase.from("documents").update({ status: "error" }).eq("id", docId);
        toast.info("Audio generation timed out. You can retry or use browser voice.");
        await fetchDocumentsWithAudio();
        return;
      }

      pollTimeoutRef.current = setTimeout(() => {
        pollForCompletion(docId);
      }, POLL_INTERVAL_MS);
    } catch (err) {
      console.error("Polling error:", err);
      setPollingDocId(null);
    }
  }, []);

  // Handle prop document change
  useEffect(() => {
    if (propDocumentId && documents.length > 0) {
      const doc = documents.find(d => d.id === propDocumentId);
      if (doc) {
        setSelectedDocument(doc);
        loadAudioForDocument(doc);
        setIsPlaying(false);
        setCurrentTime(0);
        setCurrentPauseIndex(0);
      }
    }
  }, [propDocumentId, documents]);

  // Calculate pause points based on document duration and study prompts
  useEffect(() => {
    if (selectedDocument && duration > 0) {
      const prompts = selectedDocument.study_prompts || [];
      const numPausePoints = Math.min(prompts.length, 5); // Max 5 pause points
      
      if (numPausePoints > 0) {
        // Distribute pause points evenly throughout the audio
        const interval = duration / (numPausePoints + 1);
        const points = Array.from({ length: numPausePoints }, (_, i) => 
          Math.floor(interval * (i + 1))
        );
        setPausePoints(points);
      } else {
        // If no study prompts, pause at 30%, 60%, 90%
        setPausePoints([
          Math.floor(duration * 0.3),
          Math.floor(duration * 0.6),
          Math.floor(duration * 0.9)
        ]);
      }
    }
  }, [selectedDocument, duration]);

  const fetchDocumentsWithAudio = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch ALL documents (not just those with audio)
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, audio_url, audio_language, audio_duration_seconds, study_prompts, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform study_prompts to correct type
      const typedDocs = (data || []).map(doc => ({
        ...doc,
        study_prompts: doc.study_prompts as Array<{ topic: string; prompt: string }> | null
      }));
      
      setDocuments(typedDocs);
      
      // Select first document with audio, or first document if none have audio
      const docWithAudio = typedDocs.find(d => d.audio_url);
      const selectedDoc = docWithAudio || typedDocs[0];
      
      if (selectedDoc) {
        setSelectedDocument(selectedDoc);
         setSelectedLanguage(selectedDoc.audio_language || "en");
        if (selectedDoc.audio_url) {
          loadAudioForDocument(selectedDoc);
        } else {
          setAudioUrl(null);
          // Auto-start polling if document is still processing
          if (selectedDoc.status === "processing" && !pollingDocId) {
            setPollingDocId(selectedDoc.id);
            pollCountRef.current = 0;
            pollTimeoutRef.current = setTimeout(() => {
              pollForCompletion(selectedDoc.id);
            }, POLL_INTERVAL_MS);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAudioForDocument = async (doc: Document) => {
    // Always sync language to the document (even if audio isn't available yet)
    setSelectedLanguage(doc.audio_language || "en");

    if (!doc.audio_url) {
      setAudioUrl(null);
      return;
    }
    
    try {
      // First check if we have offline version
      const offlineUrl = await getOfflineAudioUrl(doc.id);
      if (offlineUrl) {
        setAudioUrl(offlineUrl);
        setCurrentPauseIndex(0);
        return;
      }
      
      // Otherwise get from storage
      const { data } = await supabase.storage
        .from("talkpdf")
        .createSignedUrl(doc.audio_url, 3600);
      
      if (data?.signedUrl) {
        setAudioUrl(data.signedUrl);
        setCurrentPauseIndex(0);
      }
    } catch (error) {
      console.error("Error loading audio:", error);
      toast.error("Failed to load audio");
    }
  };

  const generateAudioForDocument = async (doc: Document) => {
    setGeneratingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-pdf", {
        body: {
          documentId: doc.id,
          language: selectedLanguage
        }
      });

      if (error) throw error;

      // Check if this is background processing
      if (data?.status === "processing") {
        // Start polling for completion
        toast.info("Audio generation started. This may take a minute...");
        setPollingDocId(doc.id);
        pollCountRef.current = 0;
        pollTimeoutRef.current = setTimeout(() => {
          pollForCompletion(doc.id);
        }, POLL_INTERVAL_MS);
      } else {
        // Synchronous completion (legacy path)
        await fetchDocumentsWithAudio();
        const updatedDoc = documents.find(d => d.id === doc.id);
        if (updatedDoc?.audio_url) {
          toast.success("Audio generated successfully!");
        } else {
          toast.info("Document processed, but audio generation is temporarily unavailable. You can use browser voice instead.");
        }
      }
    } catch (error: any) {
      console.error("Error generating audio:", error);
      toast.error(`Failed to generate audio: ${error.message}`);
    } finally {
      setGeneratingAudio(false);
    }
  };
  
  // Browser-based TTS fallback
  const startBrowserTTS = async () => {
    if (!selectedDocument) return;
    
    // Fetch the document summary for TTS
    try {
      const { data: docData, error } = await supabase
        .from("documents")
        .select("summary")
        .eq("id", selectedDocument.id)
        .single();
      
      if (error) throw error;
      
      const textToSpeak = docData?.summary || selectedDocument.title;
      
      if (!textToSpeak) {
        toast.error("No content available to read");
        return;
      }
      
      // Stop any existing speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      // Try to find a good voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.lang.startsWith("en") && v.name.includes("Natural")
      ) || voices.find(v => v.lang.startsWith("en"));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.onend = () => {
        setBrowserTTSPlaying(false);
        setUsingBrowserTTS(false);
      };
      
      utterance.onerror = () => {
        setBrowserTTSPlaying(false);
        toast.error("Browser voice playback failed");
      };
      
      setUsingBrowserTTS(true);
      setBrowserTTSPlaying(true);
      speechSynthesis.speak(utterance);
      toast.success("Using browser voice playback");
    } catch (error) {
      console.error("Error starting browser TTS:", error);
      toast.error("Failed to start voice playback");
    }
  };
  
  const stopBrowserTTS = () => {
    speechSynthesis.cancel();
    setBrowserTTSPlaying(false);
    setUsingBrowserTTS(false);
  };

  const handleDownloadOffline = async () => {
    if (!selectedDocument?.audio_url) return;
    
    await downloadForOffline(
      selectedDocument.id,
      selectedDocument.title,
      selectedDocument.audio_url
    );
  };

  const handleRemoveOffline = async () => {
    if (!selectedDocument) return;
    await removeOfflineAudio(selectedDocument.id);
  };

  const handleDocumentChange = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      setSelectedDocument(doc);
      setSelectedLanguage(doc.audio_language || "en");
      loadAudioForDocument(doc);
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentPauseIndex(0);
    }
  };

  // Check for pause points during playback
  const checkPausePoints = useCallback((time: number) => {
    if (!autoPauseEnabled || pausePoints.length === 0) return;
    
    // Avoid checking too frequently
    if (Math.abs(time - lastCheckedTimeRef.current) < 0.5) return;
    lastCheckedTimeRef.current = time;
    
    // Check if we've reached a pause point
    if (currentPauseIndex < pausePoints.length) {
      const pausePoint = pausePoints[currentPauseIndex];
      
      if (time >= pausePoint && time < pausePoint + 1) {
        // Pause the audio
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        
        // Get the corresponding study prompt
        const prompts = selectedDocument?.study_prompts || [];
        const prompt = prompts[currentPauseIndex] || {
          topic: `Key Concept ${currentPauseIndex + 1}`,
          prompt: "Can you explain what you just learned in your own simple words?"
        };
        
        setCurrentPromptForPause(prompt);
        setShowExplainPrompt(true);
        setCurrentPauseIndex(prev => prev + 1);
        
        toast.info("🎧 Audio paused! Time to explain what you learned.");
      }
    }
  }, [autoPauseEnabled, pausePoints, currentPauseIndex, selectedDocument]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      checkPausePoints(audio.currentTime);
    };
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl, checkPausePoints]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    setVolume(newVolume);
    audioRef.current.volume = newVolume / 100;
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume / 100;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(audioRef.current.currentTime + seconds, duration)
    );
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleContinueListening = () => {
    setShowExplainPrompt(false);
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleGoToExplainBack = () => {
    setShowExplainPrompt(false);
    if (selectedDocument && onExplainBackTrigger) {
      onExplainBackTrigger(selectedDocument.id, Math.max(0, currentPauseIndex - 1));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading audio...</div>
      </div>
    );
  }

  const hasAudio = documents.length > 0 && audioUrl;

  return (
    <div className="space-y-8">
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}

      {/* Explain-Back Prompt Dialog */}
      <Dialog open={showExplainPrompt} onOpenChange={setShowExplainPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Time to Explain!
            </DialogTitle>
            <DialogDescription>
              The audio has paused at a key concept. Test your understanding!
            </DialogDescription>
          </DialogHeader>
          
          {currentPromptForPause && (
            <div className="bg-secondary/50 rounded-lg p-4 my-4">
              <p className="text-sm text-primary font-medium mb-1">{currentPromptForPause.topic}</p>
              <p className="text-foreground">{currentPromptForPause.prompt}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Lightbulb className="h-3 w-3" />
                <span>Tip: Explain it like you're teaching a 10-year-old!</span>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleContinueListening}>
              Continue Listening
            </Button>
            <Button onClick={handleGoToExplainBack} className="gap-1">
              <Brain className="h-4 w-4" />
              Explain Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Selection */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileText className="h-4 w-4" />
            Select Document
          </label>
          <Select value={selectedDocument?.id} onValueChange={handleDocumentChange}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Select a document" />
            </SelectTrigger>
            <SelectContent>
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  <div className="flex items-center gap-2">
                    <span>{doc.title}</span>
                    {doc.audio_url ? (
                      <Badge variant="secondary" className="text-xs">Audio</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">No Audio</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Language Display and Offline Controls */}
      {selectedDocument && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Languages className="h-4 w-4" />
              Audio Language
            </label>
            <p className="text-muted-foreground">
              {nigerianLanguages.find((l) => l.code === selectedLanguage)?.name || "English"}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Offline Download/Remove buttons */}
            {selectedDocument.audio_url && (
              <>
                {isAudioCached(selectedDocument.id) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveOffline}
                    className="gap-1"
                  >
                    <WifiOff className="h-3 w-3" />
                    Remove Offline
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadOffline}
                    disabled={isDownloading === selectedDocument.id}
                    className="gap-1"
                  >
                    {isDownloading === selectedDocument.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Save Offline
                  </Button>
                )}
              </>
            )}
            
            {/* Auto-pause toggle */}
            <Button 
              variant={autoPauseEnabled ? "default" : "outline"} 
              size="sm"
              onClick={() => setAutoPauseEnabled(!autoPauseEnabled)}
              className="gap-1"
            >
              <Brain className="h-3 w-3" />
              {autoPauseEnabled ? "On" : "Off"}
            </Button>
          </div>
        </div>
      )}

      {/* Player Card */}
      <div className="bg-secondary/30 rounded-2xl p-6 md:p-8">
        {/* Show different states based on document and audio availability */}
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Headphones className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              No Documents Yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Upload a PDF first to generate audio for listening.
            </p>
          </div>
        ) : !selectedDocument?.audio_url ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              {(selectedDocument?.status === "processing" || pollingDocId === selectedDocument?.id || generatingAudio) ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              ) : (
                <Headphones className="h-10 w-10 text-primary" />
              )}
            </div>

            {/* Processing / Polling state */}
            {(selectedDocument?.status === "processing" || pollingDocId === selectedDocument?.id || generatingAudio) ? (
              <>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  Generating Audio...
                </h3>
                <p className="text-muted-foreground mb-2">
                  Your audio is being generated. This usually takes 1–3 minutes.
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  You can stay here or come back later — it'll be ready when you return.
                </p>
                <div className="w-full max-w-xs mx-auto mb-4">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary animate-pulse w-2/3" />
                  </div>
                </div>
                
                {/* Browser TTS Fallback while waiting */}
                <p className="text-sm text-muted-foreground mb-3">While you wait, you can listen with browser voice:</p>
                {!browserTTSPlaying ? (
                  <Button 
                    variant="outline"
                    onClick={startBrowserTTS}
                    className="gap-2"
                  >
                    <Volume2 className="h-4 w-4" />
                    Use Browser Voice
                  </Button>
                ) : (
                  <Button 
                    variant="destructive"
                    onClick={stopBrowserTTS}
                    className="gap-2"
                  >
                    <VolumeX className="h-4 w-4" />
                    Stop Voice
                  </Button>
                )}
              </>
            ) : (
              <>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  {selectedDocument?.status === "error" 
                    ? `Audio Failed for "${selectedDocument?.title}"`
                    : `No Audio for "${selectedDocument?.title}"`
                  }
                </h3>
                <p className="text-muted-foreground mb-4">
                  {selectedDocument?.status === "error"
                    ? "Audio generation failed. Try again or use browser voice as a fallback."
                    : "This document doesn't have audio yet. Generate it or use browser voice as a fallback."
                  }
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => selectedDocument && generateAudioForDocument(selectedDocument)}
                    disabled={generatingAudio}
                    className="gap-2"
                  >
                    <Headphones className="h-4 w-4" />
                    Generate Audio
                  </Button>
                  
                  {!browserTTSPlaying ? (
                    <Button 
                      variant="outline"
                      onClick={startBrowserTTS}
                      className="gap-2"
                    >
                      <Volume2 className="h-4 w-4" />
                      Use Browser Voice
                    </Button>
                  ) : (
                    <Button 
                      variant="destructive"
                      onClick={stopBrowserTTS}
                      className="gap-2"
                    >
                      <VolumeX className="h-4 w-4" />
                      Stop Voice
                    </Button>
                  )}
                </div>
              </>
            )}
            
            {usingBrowserTTS && (
              <p className="text-xs text-primary mt-4 animate-pulse">
                🔊 Browser voice is reading your document...
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Current Track Info */}
            <div className="text-center mb-6">
              <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                {selectedDocument?.title || "Document"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {nigerianLanguages.find((l) => l.code === selectedLanguage)?.name}
              </p>
              {autoPauseEnabled && pausePoints.length > 0 && (
                <p className="text-xs text-primary mt-1">
                  🎯 {pausePoints.length - currentPauseIndex} explain-back checkpoints remaining
                </p>
              )}
            </div>

            {/* Progress Bar with pause point markers */}
            <div className="space-y-2 mb-6">
              <div className="relative">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />
                {/* Pause point markers */}
                {autoPauseEnabled && pausePoints.map((point, index) => (
                  <div
                    key={index}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary"
                    style={{ left: `${(point / duration) * 100}%` }}
                    title={`Checkpoint ${index + 1}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(-10)}
                className="h-10 w-10"
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                onClick={togglePlay}
                className="h-14 w-14 rounded-full"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-1" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(10)}
                className="h-10 w-10"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={handleVolumeChange}
                className="w-24 cursor-pointer"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;
