import { SignIn } from "@clerk/nextjs";
import { AudioLines } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Navbar */}
      <nav className="w-full px-6 py-4 border-b border-white/10 backdrop-blur-md bg-slate-950/80 fixed top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/home">
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur-sm"></div>
                <div className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center border border-gray-700">
                  <AudioLines className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Music Stream
              </span>
            </div>
          </Link>
        </div>
      </nav>

      {/* Sign-in Container */}
      <div className="pt-24 pb-16 px-4 flex justify-center items-center min-h-screen">
        <div className="bg-slate-900 p-8 rounded-xl shadow-2xl max-w-md w-full border border-slate-800">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
              Welcome Back
            </h1>
            <p className="text-slate-400 text-sm">
              Sign in to continue to your dashboard
            </p>
          </div>

          <SignIn
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
            redirectUrl="/home"
            appearance={{
              variables: {
                colorPrimary: "#4f83cc", // Primary color for buttons
                colorBackground: "#ffffff", // Background color
                colorText: "#333333", // Text color
                fontFamily: "Arial, sans-serif", // Custom font
              },

            }}
          />

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-xs">
              © 2025 Music Stream. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}