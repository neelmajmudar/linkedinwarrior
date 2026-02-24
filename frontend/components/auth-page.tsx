"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Sword, Linkedin, ArrowRight, Loader2 } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Check your email for a confirmation link.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(error.message);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-white via-warm-50 to-warm-100">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo & Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warm-500 mb-6">
            <Sword className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-4xl tracking-tight text-[#1a1a1a] mb-3">
            LinkedInWarrior
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-sm mx-auto">
            AI-powered content that sounds like you.
            <br />
            <span className="text-[#1a1a1a] font-medium">
              Dominate your LinkedIn feed.
            </span>
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            {message && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 border border-green-100">
                <p className="text-sm text-green-700">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Create Account" : "Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-center text-sm text-gray-500">
              {isSignUp
                ? "Already have an account?"
                : "Don\u2019t have an account?"}{" "}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                  setMessage("");
                }}
                className="text-warm-500 hover:text-warm-600 font-medium transition-colors"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Linkedin className="h-3.5 w-3.5" />
          <span>Powered by AI &middot; Built for LinkedIn creators</span>
        </div>
      </div>
    </div>
  );
}
