import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Volume2, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface DocumentWithProfile {
  id: string;
  title: string;
  file_name: string;
  status: string;
  audio_url: string | null;
  audio_language: string | null;
  audio_duration_seconds: number | null;
  created_at: string;
  tts_metadata: {
    tts_provider?: string;
    requested_language?: string;
    translation_applied?: boolean;
    failed_providers?: string[];
    voice_used?: string;
    file_type?: string;
  } | null;
  profiles: {
    email: string | null;
    full_name: string | null;
  } | null;
}

interface ProviderStats {
  name: string;
  count: number;
  fill: string;
}

interface ErrorLog {
  id: string;
  title: string;
  email: string;
  failed_providers: string[];
  created_at: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  yarngpt: "hsl(var(--chart-1))",
  elevenlabs: "hsl(var(--chart-2))",
  "openrouter-gemini": "hsl(var(--chart-3))",
  "lovable-gemini": "hsl(var(--chart-4))",
  none: "hsl(var(--chart-5))",
};

const languageLabels: Record<string, string> = {
  en: "English",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
  pcm: "Pidgin",
};

const AdminDocumentAnalytics = () => {
  const [documents, setDocuments] = useState<DocumentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          id,
          title,
          file_name,
          status,
          audio_url,
          audio_language,
          audio_duration_seconds,
          created_at,
          tts_metadata,
          profiles!documents_user_id_fkey (
            email,
            full_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching documents:", error);
        return;
      }

      // Transform the data
      const transformedDocs = (data || []).map((doc: any) => ({
        ...doc,
        tts_metadata: doc.tts_metadata as DocumentWithProfile["tts_metadata"],
        profiles: doc.profiles as DocumentWithProfile["profiles"],
      }));

      setDocuments(transformedDocs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  // Calculate provider statistics
  const providerStats: ProviderStats[] = (() => {
    const counts: Record<string, number> = {};
    documents.forEach((doc) => {
      const provider = doc.tts_metadata?.tts_provider || "none";
      counts[provider] = (counts[provider] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name: name === "yarngpt" ? "YarnGPT" : 
            name === "elevenlabs" ? "ElevenLabs" :
            name === "openrouter-gemini" ? "OpenRouter" :
            name === "lovable-gemini" ? "Lovable" :
            name === "none" ? "No Audio" : name,
      count,
      fill: PROVIDER_COLORS[name] || "hsl(var(--muted))",
    }));
  })();

  // Calculate language statistics
  const languageStats = (() => {
    const counts: Record<string, number> = {};
    documents.forEach((doc) => {
      const lang = doc.audio_language || "en";
      counts[lang] = (counts[lang] || 0) + 1;
    });
    return Object.entries(counts).map(([lang, count]) => ({
      name: languageLabels[lang] || lang,
      count,
      fill: `hsl(var(--chart-${Object.keys(counts).indexOf(lang) + 1}))`,
    }));
  })();

  // Get error logs
  const errorLogs: ErrorLog[] = documents
    .filter((doc) => doc.tts_metadata?.failed_providers && doc.tts_metadata.failed_providers.length > 0)
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      email: doc.profiles?.email || "Unknown",
      failed_providers: doc.tts_metadata?.failed_providers || [],
      created_at: doc.created_at,
    }));

  // Calculate success rate
  const totalDocs = documents.length;
  const successfulDocs = documents.filter((d) => d.audio_url).length;
  const successRate = totalDocs > 0 ? ((successfulDocs / totalDocs) * 100).toFixed(1) : 0;

  // Calculate file type stats
  const fileTypeStats = (() => {
    const counts: Record<string, number> = { pdf: 0, word: 0 };
    documents.forEach((doc) => {
      const fileType = doc.tts_metadata?.file_type || "pdf";
      counts[fileType] = (counts[fileType] || 0) + 1;
    });
    return counts;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chartConfig = {
    yarngpt: { label: "YarnGPT", color: "hsl(var(--chart-1))" },
    elevenlabs: { label: "ElevenLabs", color: "hsl(var(--chart-2))" },
    openrouter: { label: "OpenRouter", color: "hsl(var(--chart-3))" },
    lovable: { label: "Lovable", color: "hsl(var(--chart-4))" },
    none: { label: "No Audio", color: "hsl(var(--chart-5))" },
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Documents</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <FileText className="h-6 w-6 text-muted-foreground" />
              {totalDocs}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {fileTypeStats.pdf} PDFs, {fileTypeStats.word} Word docs
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Audio Success Rate</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Volume2 className="h-6 w-6 text-muted-foreground" />
              {successRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {successfulDocs} of {totalDocs} documents
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>YarnGPT Usage</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              {providerStats.find((p) => p.name === "YarnGPT")?.count || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Nigerian native voices
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>TTS Errors</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              {errorLogs.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Documents with fallbacks
          </CardContent>
        </Card>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">All Documents</TabsTrigger>
          <TabsTrigger value="errors">Error Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Provider Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TTS Provider Distribution</CardTitle>
                <CardDescription>Which providers are being used</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={providerStats}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, count }) => `${name}: ${count}`}
                      >
                        {providerStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Language Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Language Distribution</CardTitle>
                <CardDescription>Audio generated by language</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={languageStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Voice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.slice(0, 50).map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="max-w-[200px] truncate">{doc.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.profiles?.email?.split("@")[0] || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(doc.tts_metadata?.file_type || "pdf").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.audio_url ? "default" : "secondary"}>
                          {doc.tts_metadata?.tts_provider || "none"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {languageLabels[doc.audio_language || "en"] || doc.audio_language}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.tts_metadata?.voice_used || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.status === "ready" ? "default" : doc.status === "error" ? "destructive" : "secondary"}>
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">TTS Error Logs</CardTitle>
              <CardDescription>Documents with failed TTS providers</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {errorLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No TTS errors recorded</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Failed Providers</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="max-w-[200px] truncate">{log.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.email.split("@")[0]}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {log.failed_providers.map((provider, idx) => (
                              <Badge key={idx} variant="destructive" className="text-xs">
                                {provider}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDocumentAnalytics;
