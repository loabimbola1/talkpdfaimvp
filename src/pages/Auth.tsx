import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, Loader2, Mail } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const loginPasswordSchema = z.string().min(1, "Please enter your password");

type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for reset password mode from URL
    const urlMode = searchParams.get("mode");
    if (urlMode === "reset") {
      setMode("reset-password");
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset-password");
      } else if (session?.user && mode !== "reset-password") {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && mode !== "reset-password") {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams, mode]);

  const validateInputs = () => {
    try {
      if (mode === "forgot-password") {
        emailSchema.parse(email);
        return true;
      }
      
      if (mode === "reset-password") {
        passwordSchema.parse(password);
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          return false;
        }
        return true;
      }

      emailSchema.parse(email);
      if (mode === "login") {
        loginPasswordSchema.parse(password);
      } else {
        passwordSchema.parse(password);
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return false;
    }
  };

  const handleForgotPassword = async () => {
    if (!validateInputs()) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      
      if (error) throw error;
      
      setResetEmailSent(true);
      toast.success("Password reset link sent to your email!");
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validateInputs()) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      toast.success("Password updated successfully!");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Update password error:", error);
      toast.error("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "forgot-password") {
      await handleForgotPassword();
      return;
    }
    
    if (mode === "reset-password") {
      await handleResetPassword();
      return;
    }
    
    if (!validateInputs()) return;
    
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please login instead.");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("Account created successfully!");
        navigate("/dashboard");
      }
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderForgotPasswordForm = () => (
    <>
      <div className="text-center mb-8">
        <Link to="/" className="inline-flex items-center justify-center mb-4">
          <span className="font-display text-3xl font-bold text-foreground tracking-tight">
            TalkPDF AI
          </span>
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {resetEmailSent ? "Check Your Email" : "Forgot Password"}
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          {resetEmailSent
            ? "We've sent a password reset link to your email"
            : "Enter your email address and we'll send you a reset link"}
        </p>
      </div>

      {resetEmailSent ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center p-4 bg-primary/10 rounded-lg">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Didn't receive the email? Check your spam folder or{" "}
            <button
              type="button"
              onClick={() => setResetEmailSent(false)}
              className="text-primary hover:underline font-medium"
            >
              try again
            </button>
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setMode("login");
              setResetEmailSent(false);
            }}
          >
            Back to Sign In
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <Button type="submit" className="w-full h-11 rounded-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setMode("login")}
          >
            Back to Sign In
          </Button>
        </form>
      )}
    </>
  );

  const renderResetPasswordForm = () => (
    <>
      <div className="text-center mb-8">
        <Link to="/" className="inline-flex items-center justify-center mb-4">
          <span className="font-display text-3xl font-bold text-foreground tracking-tight">
            TalkPDF AI
          </span>
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Set New Password
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters with uppercase, lowercase, number, and special character.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <Button type="submit" className="w-full h-11 rounded-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Updating...
            </>
          ) : (
            "Update Password"
          )}
        </Button>
      </form>
    </>
  );

  const renderLoginSignupForm = () => (
    <>
      <div className="text-center mb-8">
        <Link to="/" className="inline-flex items-center justify-center mb-4">
          <span className="font-display text-3xl font-bold text-foreground tracking-tight">
            TalkPDF AI
          </span>
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {mode === "login" ? "Welcome Back" : "Create Account"}
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          {mode === "login"
            ? "Sign in to continue learning"
            : "Start your learning journey today"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-11"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={mode === "login" ? "Enter your password" : "Create a strong password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mode === "signup" && (
            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters with uppercase, lowercase, number, and special character.
            </p>
          )}
        </div>

        {mode === "login" && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setMode("forgot-password")}
              className="text-sm text-primary hover:underline"
            >
              Forgot your password?
            </button>
          </div>
        )}

        <Button type="submit" className="w-full h-11 rounded-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Please wait...
            </>
          ) : mode === "login" ? (
            "Sign In"
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-primary hover:underline font-medium"
          >
            {mode === "login" ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="bg-card rounded-2xl shadow-elevated p-8 border border-border">
          {mode === "forgot-password" && renderForgotPasswordForm()}
          {mode === "reset-password" && renderResetPasswordForm()}
          {(mode === "login" || mode === "signup") && renderLoginSignupForm()}
        </div>
      </div>
    </div>
  );
};

export default Auth;
