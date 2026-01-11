import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Mail, Save, Loader2, Crown, Calendar, Bell, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import NotificationSettings from "./NotificationSettings";
import SubscriptionStatus from "./SubscriptionStatus";

// Nigerian universities list
const nigerianUniversities = [
  { value: "lautech", label: "Ladoke Akintola University of Technology (LAUTECH)" },
  { value: "fountain", label: "Fountain University, Osogbo" },
  { value: "unilag", label: "University of Lagos (UNILAG)" },
  { value: "ui", label: "University of Ibadan (UI)" },
  { value: "oau", label: "Obafemi Awolowo University (OAU)" },
  { value: "unn", label: "University of Nigeria, Nsukka (UNN)" },
  { value: "abu", label: "Ahmadu Bello University (ABU)" },
  { value: "uniben", label: "University of Benin (UNIBEN)" },
  { value: "unilorin", label: "University of Ilorin (UNILORIN)" },
  { value: "futa", label: "Federal University of Technology, Akure (FUTA)" },
  { value: "covenant", label: "Covenant University" },
  { value: "babcock", label: "Babcock University" },
  { value: "lasu", label: "Lagos State University (LASU)" },
  { value: "uniosun", label: "Osun State University (UNIOSUN)" },
  { value: "bowen", label: "Bowen University" },
  { value: "eksu", label: "Ekiti State University" },
  { value: "fupre", label: "Federal University of Petroleum Resources" },
  { value: "uniport", label: "University of Port Harcourt (UNIPORT)" },
  { value: "unical", label: "University of Calabar (UNICAL)" },
  { value: "buk", label: "Bayero University Kano (BUK)" },
  { value: "unimaid", label: "University of Maiduguri (UNIMAID)" },
  { value: "udusok", label: "Usman Danfodiyo University Sokoto" },
  { value: "nau", label: "Nnamdi Azikiwe University (NAU)" },
  { value: "other", label: "Other University" },
];

interface Profile {
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  university: string | null;
}

interface ProfileSettingsProps {
  user: SupabaseUser | null;
}

const ProfileSettings = ({ user }: ProfileSettingsProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    university: "",
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || "",
          university: data.university || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          university: formData.university || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Profile updated successfully");
      
      // Also update auth user metadata
      await supabase.auth.updateUser({
        data: { full_name: formData.full_name }
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {getInitials(formData.full_name || user?.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">
                {formData.full_name || "Set your name"}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Separator />

          {/* Form */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                }
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="university" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                University
              </Label>
              <Select 
                value={formData.university} 
                onValueChange={(value) => setFormData((prev) => ({ ...prev, university: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your university" />
                </SelectTrigger>
                <SelectContent>
                  {nigerianUniversities.map((uni) => (
                    <SelectItem key={uni.value} value={uni.value}>
                      {uni.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Join campus leaderboards by selecting your university
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Subscription Status
          </CardTitle>
          <CardDescription>
            View and manage your subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionStatus onUpgrade={() => {
            // Navigate to subscription tab in dashboard
            const event = new CustomEvent("navigateToTab", { detail: { tab: "subscription" } });
            window.dispatchEvent(event);
          }} />
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Manage study reminders and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettings />
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account created</span>
              <span className="text-foreground">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last sign in</span>
              <span className="text-foreground">
                {user?.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSettings;
