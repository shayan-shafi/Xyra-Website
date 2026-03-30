"use client";

import { useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

export default function ReferralPage() {
  const { code } = useParams<{ code: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email,
          referredBy: code,
        }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center mb-12">
          <Image
            src="/assets/xyra-logo.png"
            alt="Xyra"
            width={280}
            height={90}
            className="h-16 w-auto"
            priority
          />
        </div>

        {status === "success" ? (
          <div className="text-center">
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-medium text-black tracking-tight">
              You&apos;re in.
            </h1>
            <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-black/50 mt-4 leading-relaxed">
              Check your email for your position and your own referral link.
            </p>
            <a
              href="/"
              className="inline-block mt-8 px-7 py-3 bg-black text-white font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase"
            >
              Learn more about Xyra
            </a>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <h1 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl font-medium text-black tracking-tight">
                Someone thinks you&apos;d
                <br />
                <span className="italic">love this.</span>
              </h1>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-black/50 mt-4 leading-relaxed">
                A friend referred you to Xyra. Join the waitlist and you both move up.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full px-5 py-4 border border-black/15 bg-white font-[family-name:var(--font-jetbrains)] text-sm text-black placeholder:text-black/30 focus:outline-none focus:border-black/40 transition-colors"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-5 py-4 border border-black/15 bg-white font-[family-name:var(--font-jetbrains)] text-sm text-black placeholder:text-black/30 focus:outline-none focus:border-black/40 transition-colors"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full px-7 py-4 bg-black text-white font-[family-name:var(--font-jetbrains)] text-sm tracking-widest uppercase hover:bg-black/85 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "Joining..." : "Join the Waitlist"}
              </button>
            </form>

            {status === "error" && (
              <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-red-500 mt-4 text-center">
                Something went wrong. Please try again.
              </p>
            )}

            <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-black/30 mt-8 text-center">
              Xyra is a personal operating system that builds itself from your voice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
