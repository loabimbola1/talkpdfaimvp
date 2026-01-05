import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
}

const AudioPlayer = () => {
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
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchDocumentsWithAudio();
  }, []);

  const fetchDocumentsWithAudio = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("documents")
        .select("id, title, audio_url, audio_language, audio_duration_seconds")
        .eq("user_id", user.id)
        .not("audio_url", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      
      if (data && data.length > 0) {
        setSelectedDocument(data[0]);
        loadAudioForDocument(data[0]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAudioForDocument = async (doc: Document) => {
    if (!doc.audio_url) return;
    
    try {
      const { data } = await supabase.storage
        .from("talkpdf")
        .createSignedUrl(doc.audio_url, 3600);
      
      if (data?.signedUrl) {
        setAudioUrl(data.signedUrl);
        setSelectedLanguage(doc.audio_language || "en");
      }
    } catch (error) {
      console.error("Error loading audio:", error);
      toast.error("Failed to load audio");
    }
  };

  const handleDocumentChange = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      setSelectedDocument(doc);
      loadAudioForDocument(doc);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
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
  }, [audioUrl]);

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
                  {doc.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Language Display */}
      {selectedDocument && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Languages className="h-4 w-4" />
            Audio Language
          </label>
          <p className="text-muted-foreground">
            {nigerianLanguages.find((l) => l.code === selectedLanguage)?.name || "English"}
          </p>
        </div>
      )}

      {/* Player Card */}
      <div className="bg-secondary/30 rounded-2xl p-6 md:p-8">
        {!hasAudio ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Headphones className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              No Audio Available
            </h3>
            <p className="text-muted-foreground mb-6">
              Upload and process a PDF first, then your audio will appear here.
            </p>
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
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mb-6">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />
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
