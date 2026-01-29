import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Users, CreditCard, BarChart3, Shield, Loader2, AlertTriangle, Gift, FileText } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import AdminReferralAnalytics from "@/components/dashboard/AdminReferralAnalytics";
import AdminDocumentAnalytics from "@/components/dashboard/AdminDocumentAnalytics";

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAdminDashboardData();
  }, []);

  const fetchAdminDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      // All admin verification and data fetching happens server-side
      // This prevents client-side authorization bypass attacks
      const { data, error } = await supabase.functions.invoke('admin-dashboard-data');
      
      if (error) {
        console.error("Admin dashboard error:", error);
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      if (data.error) {
        toast.error(data.error);
        navigate("/dashboard");
        return;
      }

      // Set data from server-side response
      setUsers(data.users || []);
      setPayments(data.payments || []);
      setUsageStats(data.usageStats || []);
      setIsAdmin(true);
    } catch (error) {
      console.error("Error loading admin dashboard:", error);
      toast.error("Failed to load admin dashboard");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const totalRevenue = payments.filter(p => p.status === "successful").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalUsers = users.length;
  const totalConversions = usageStats.filter(u => u.action_type === "audio_conversion").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="TalkPDF AI" className="h-8 w-auto" />
            </Link>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users, subscriptions, and monitor AI usage.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl">{totalUsers}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-3xl">₦{totalRevenue.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Audio Conversions</CardDescription>
              <CardTitle className="text-3xl">{totalConversions}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>AI Status</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Badge variant={aiEnabled ? "default" : "destructive"}>{aiEnabled ? "Active" : "Disabled"}</Badge>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Emergency AI Control */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Emergency AI Control
            </CardTitle>
            <CardDescription>Quickly enable or disable AI features across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
              <div>
                <p className="font-medium">AI Text-to-Speech & Explain-Back</p>
                <p className="text-sm text-muted-foreground">Toggle to enable/disable all AI features</p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
            </div>
            {!aiEnabled && (
              <div className="flex items-center gap-2 mt-4 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">AI features are currently disabled for all users</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="users">
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Users</TabsTrigger>
            <TabsTrigger value="payments" className="gap-2"><CreditCard className="h-4 w-4" />Payments</TabsTrigger>
            <TabsTrigger value="usage" className="gap-2"><BarChart3 className="h-4 w-4" />Usage</TabsTrigger>
            <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4" />Documents</TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2"><Gift className="h-4 w-4" />Referrals</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.full_name || "N/A"}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell><Badge variant="outline">{user.subscription_plan || "free"}</Badge></TableCell>
                        <TableCell><Badge>{user.subscription_status || "active"}</Badge></TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.plan}</TableCell>
                        <TableCell>₦{Number(payment.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={payment.status === "successful" ? "default" : "secondary"}>{payment.status}</Badge>
                        </TableCell>
                        <TableCell>{payment.billing_cycle}</TableCell>
                        <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Audio Minutes</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageStats.slice(0, 20).map((usage) => (
                      <TableRow key={usage.id}>
                        <TableCell><Badge variant="outline">{usage.action_type}</Badge></TableCell>
                        <TableCell>{usage.tokens_used}</TableCell>
                        <TableCell>{usage.audio_minutes_used}</TableCell>
                        <TableCell>{new Date(usage.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <AdminDocumentAnalytics />
          </TabsContent>

          <TabsContent value="referrals">
            <AdminReferralAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
