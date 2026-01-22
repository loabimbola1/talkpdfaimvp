import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Mail, CheckCircle2, AlertCircle, Loader2, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CampusVerificationProps {
  onVerified?: () => void;
}

const CampusVerification = ({ onVerified }: CampusVerificationProps) => {
  const [campusEmail, setCampusEmail] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("campus_verified, campus_email")
        .eq("user_id", user.id)
        .single();

      if (profile?.campus_verified) {
        setIsVerified(true);
        setVerifiedEmail(profile.campus_email);
        onVerified?.();
      }
    } catch (error) {
      console.error("Error checking verification status:", error);
    } finally {
      setLoading(false);
    }
  };

  const isValidCampusEmail = (email: string): boolean => {
    const lowerEmail = email.toLowerCase().trim();
    return lowerEmail.endsWith(".edu") || lowerEmail.endsWith(".edu.ng");
  };

  const handleVerify = async () => {
    if (!campusEmail.trim()) {
      toast.error("Please enter your campus email address");
      return;
    }

    if (!isValidCampusEmail(campusEmail)) {
      toast.error("Please enter a valid .edu or .edu.ng email address");
      return;
    }

    setIsVerifying(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to verify");
        return;
      }

      // Update profile with campus verification
      const { error } = await supabase
        .from("profiles")
        .update({
          campus_verified: true,
          campus_email: campusEmail.toLowerCase().trim(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setIsVerified(true);
      setVerifiedEmail(campusEmail.toLowerCase().trim());
      toast.success("Campus verification successful! 🎓");
      onVerified?.();
    } catch (error) {
      console.error("Error verifying campus email:", error);
      toast.error("Failed to verify. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-2">
          Campus Verified ✓
        </h3>
        <p className="text-sm text-muted-foreground">
          Verified with: <span className="font-medium text-foreground">{verifiedEmail}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <School className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Verify Your Campus
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Verify your student status to unlock the Campus Leaderboard and compete with classmates at your university.
        </p>
      </div>

      {/* Verification Form */}
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-secondary/30 rounded-xl p-4 border border-border">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">How verification works</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your university email address ending in <strong>.edu</strong> or <strong>.edu.ng</strong> to verify your student status.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="campus-email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Campus Email Address
          </Label>
          <Input
            id="campus-email"
            type="email"
            placeholder="yourname@university.edu.ng"
            value={campusEmail}
            onChange={(e) => setCampusEmail(e.target.value)}
            className="w-full"
          />
          {campusEmail && !isValidCampusEmail(campusEmail) && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" />
              Email must end with .edu or .edu.ng
            </p>
          )}
        </div>

        <Button
          onClick={handleVerify}
          disabled={isVerifying || !campusEmail || !isValidCampusEmail(campusEmail)}
          className="w-full"
        >
          {isVerifying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify Campus Email
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          This helps ensure fair competition on campus leaderboards.
        </p>
      </div>
    </div>
  );
};

export default CampusVerification;
