import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "../contexts/AuthContext";
import { createClient } from "@/utils/supabase/client";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthDialog() {
  const { showAuthDialog, setShowAuthDialog } = useAuth();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password" | "check-email">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // First, try to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError) {
        // Signed in successfully
        setShowAuthDialog(false);
        return;
      }

      // Sign in failed - try sign up (user might be new)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        // Both failed - show error
        setError(signUpError.message);
        return;
      }

      // Check if user already existed (signUp returns user with empty identities)
      if (signUpData.user?.identities?.length === 0) {
        // User exists but password was wrong
        setError("Invalid password");
        return;
      }

      // New user created
      if (signUpData.session) {
        // Auto-confirmed, user is signed in
        setShowAuthDialog(false);
      } else {
        // Email confirmation required
        setStep("check-email");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep("email");
    setPassword("");
    setError(null);
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setError("Check your email for a password reset link.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-transparent border-0">
        <div>
          {/* Auth form */}
          <div className="p-8 bg-white h-full flex flex-col rounded-lg">
            {step === "check-email" ? (
              <div className="text-center py-4">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-2xl font-pphatton font-bold text-heading mb-2">
                  Check your email
                </h3>
                <p className="text-body text-sm leading-relaxed mb-6">
                  We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
                </p>
                <Button
                  onClick={() => {
                    setStep("email");
                    setPassword("");
                  }}
                  variant="outline"
                  className="w-full rounded-full h-12"
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <div className="mb-6">
                <h3 className="text-2xl font-pphatton font-bold text-heading mb-2">
                  Welcome
                </h3>
                <p className="text-body text-sm leading-relaxed">
                  {step === "email"
                    ? "Sign in to continue learning, or create an account to get started."
                    : "Enter your password. If you're new here, this creates your account."}
                </p>
              </div>
            )}

            {step === "email" && (
              <form
                onSubmit={handleEmailSubmit}
                className="flex flex-col justify-between h-full gap-8"
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g. habibi123@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="py-6 px-4 shadow-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900/20 focus:ring-offset-white focus:border-gray-900"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  type="submit"
                  className="w-full rounded-full h-12 text-sm font-medium bg-gray-900 hover:bg-gray-800"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === "password" && (
              <form
                onSubmit={handlePasswordSubmit}
                className="h-full flex flex-col justify-between gap-8"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
                    <p className="text-sm text-body">{email}</p>
                    <button
                      type="button"
                      onClick={handleChangeEmail}
                      className="text-sm text-subtle hover:text-heading transition"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      minLength={6}
                      className="py-6 px-4 shadow-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900/20 focus:ring-offset-white focus:border-gray-900"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                  type="submit"
                  className="w-full rounded-full h-12 text-sm font-medium bg-gray-900 hover:bg-gray-800"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Continue"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="w-full text-sm text-body hover:text-heading"
                >
                  Forgot password?
                </button>
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
