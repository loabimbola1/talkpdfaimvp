import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentStatus = "loading" | "success" | "failed" | "cancelled";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [plan, setPlan] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPayment = async () => {
      const transactionId = searchParams.get("transaction_id");
      const txRef = searchParams.get("tx_ref");
      const paymentStatus = searchParams.get("status");

      // Handle cancelled/abandoned payments gracefully
      if (paymentStatus === "cancelled" || paymentStatus === "failed") {
        setStatus("cancelled");
        setErrorMessage("You cancelled the payment. No charges were made.");
        return;
      }

      // Missing transaction details - likely direct navigation or error
      if (!transactionId || !txRef) {
        setStatus("failed");
        setErrorMessage("Missing payment details. Please try again from the pricing page.");
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          toast.error("Please sign in to verify your payment");
          setStatus("failed");
          setErrorMessage("You need to be signed in to verify your payment.");
          return;
        }

        const { data, error } = await supabase.functions.invoke("flutterwave-verify", {
          body: {
            transaction_id: transactionId,
            tx_ref: txRef,
          },
        });

        if (error) {
          console.error("Verification error:", error);
          setStatus("failed");
          setErrorMessage(error.message || "Payment verification failed. Please contact support.");
          return;
        }

        if (!data?.success) {
          console.error("Verification failed:", data);
          setStatus("failed");
          setErrorMessage(data?.message || "Payment could not be verified. Please contact support.");
          return;
        }

        setPlan(data.plan);
        setStatus("success");
        toast.success("Payment successful! Welcome to TalkPDF AI!");
      } catch (error) {
        console.error("Payment verification failed:", error);
        setStatus("failed");
        setErrorMessage("An unexpected error occurred. Please contact support.");
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-elevated p-8 border border-border text-center">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center justify-center mb-6">
            <span className="font-display text-2xl font-bold text-foreground tracking-tight">
              TalkPDF AI
            </span>
          </Link>

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
              <Button onClick={() => navigate("/dashboard")} className="w-full rounded-full">
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "cancelled" && (
            <>
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-10 w-10 text-amber-500" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                Payment Cancelled
              </h2>
              <p className="text-muted-foreground mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Button onClick={() => navigate("/?scrollTo=pricing")} className="w-full rounded-full">
                  View Pricing Plans
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="w-full rounded-full"
                >
                  Go to Dashboard
                </Button>
              </div>
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
                {errorMessage || "We couldn't verify your payment. Please try again or contact support."}
              </p>
              <div className="space-y-3">
                <Button onClick={() => navigate("/?scrollTo=pricing")} className="w-full rounded-full">
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/contact")}
                  className="w-full rounded-full"
                >
                  Contact Support
                </Button>
                <Button
                  variant="ghost"
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
