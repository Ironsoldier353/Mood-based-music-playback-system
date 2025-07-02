'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Music, User, Calendar, Sparkles } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser(); 

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🛡️ Redirect if already onboarded
  useEffect(() => {
    const checkOnboarded = async () => {
      if (!isLoaded || !user?.id) return;

      const res = await fetch(`/api/check-user?clerkId=${user.id}`);
      const data = await res.json();

      if (data?.onboarded) {
        router.push("/home");
      }
    };

    checkOnboarded();
  }, [isLoaded, user, router]);

  const handleSubmit = async () => {
    if (!fullName.trim() || !dob) {
      alert("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clerkId: user?.id,
          fullName: fullName.trim(),
          dob,
        }),
      });

      if (res.ok) {
        router.push("/home");
      } else {
        alert("Failed to submit onboarding");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-48 h-48 bg-blue-500/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl animate-pulse delay-500"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Glass card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Music className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="w-6 h-6 text-yellow-400 animate-bounce" />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to Music Stream!</h1>
            <p className="text-purple-200 text-sm">Let&apos;s personalize your music experience</p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Full Name Input */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            {/* Date of Birth Input */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date of Birth
              </label>
              <div className="relative">
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm [color-scheme:dark]"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-2xl shadow-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-4 focus:ring-purple-500/50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Setting up your profile...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  Let&apos;s Get Started
                  <Sparkles className="w-5 h-5" />
                </div>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-purple-200 text-xs">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>

        {/* Floating music notes */}
        <div className="absolute -top-4 -left-4 text-purple-400 animate-bounce delay-300">
          <Music className="w-6 h-6" />
        </div>
        <div className="absolute -bottom-4 -right-4 text-pink-400 animate-bounce delay-700">
          <Music className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}