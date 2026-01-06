import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [plan, setPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPayment = async () => {
      const transactionId = searchParams.get("transaction_id");
      const txRef = searchParams.get("tx_ref");
      const paymentStatus = searchParams.get("status");

      if (paymentStatus === "cancelled") {
        setStatus("failed");
        return;
      }

      if (!transactionId || !txRef) {
        setStatus("failed");
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          toast.error("Please sign in to verify your payment");
          setStatus("failed");
          return;
        }

        const { data, error } = await supabase.functions.invoke("flutterwave-verify", {
          body: {
            transaction_id: transactionId,
            tx_ref: txRef,
          },
        });

        if (error || !data.success) {
          console.error("Verification error:", error || data);
          setStatus("failed");
          return;
        }

        setPlan(data.plan);
        setStatus("success");
        toast.success("Payment successful! Welcome to TalkPDF AI!");
      } catch (error) {
        console.error("Payment verification failed:", error);
        setStatus("failed");
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-elevated p-8 border border-border text-center">
          <img src={logo} alt="TalkPDF AI" className="h-10 mx-auto mb-6" />

          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin mb-4" />
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                Verifying Payment
              </h2>
              <p className="text-muted-foreground">
                Please wait while we confirm your payment...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                Payment Successful!
              </h2>
              <p className="text-muted-foreground mb-2">
                You're now subscribed to the {plan} plan.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Start learning with unlimited access to TalkPDF AI features.
              </p>
              <Button onClick={() => navigate("/dashboard")} className="w-full">
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "failed" && (
            <>
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                Payment Failed
              </h2>
              <p className="text-muted-foreground mb-6">
                We couldn't verify your payment. Please try again or contact support.
              </p>
              <div className="space-y-3">
                <Button onClick={() => navigate("/#pricing")} className="w-full">
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="w-full"
                >
                  Go to Home
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentCallback;
