import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

interface ErrorFallbackProps {
  error?: Error | null;
  onReset?: () => void;
}

export const ErrorFallback = ({ error, onReset }: ErrorFallbackProps) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/");
    if (onReset) {
      onReset();
    }
  };

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Something went wrong
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        We encountered an unexpected error. Please try again or return to the home page.
      </p>
      {error && process.env.NODE_ENV === "development" && (
        <pre className="text-xs text-muted-foreground bg-secondary p-3 rounded-lg mb-4 max-w-md overflow-auto text-left">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        {onReset && (
          <Button onClick={onReset} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
        <Button onClick={handleGoHome}>
          <Home className="h-4 w-4 mr-2" />
          Go Home
        </Button>
      </div>
    </div>
  );
};
