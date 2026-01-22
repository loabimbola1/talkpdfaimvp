import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import CampusVerification from "./CampusVerification";
import CampusLeaderboard from "./CampusLeaderboard";

const CampusTab = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("campus_verified")
        .eq("user_id", user.id)
        .single();

      setIsVerified(profile?.campus_verified || false);
    } catch (error) {
      console.error("Error checking campus verification:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerified = () => {
    setIsVerified(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Checking verification status...</p>
      </div>
    );
  }

  // Show verification prompt if not verified
  if (!isVerified) {
    return <CampusVerification onVerified={handleVerified} />;
  }

  // Show campus leaderboard if verified
  return <CampusLeaderboard />;
};

export default CampusTab;
