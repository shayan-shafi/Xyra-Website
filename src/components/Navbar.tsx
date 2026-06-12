"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { track } from "@/lib/analytics";

export default function Navbar() {
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const updateVisibility = useCallback(() => {
    const waitlist = document.getElementById("waitlist");
    if (!waitlist) return;

    const rect = waitlist.getBoundingClientRect();
    // Show navbar once the waitlist section is near the top of viewport
    setVisible(rect.top <= 100);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();
    return () => window.removeEventListener("scroll", updateVisibility);
  }, [updateVisibility]);

  return (
    <motion.nav
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : -20,
      }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10 ${
        visible ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div className="mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex h-20 sm:h-24 items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3">
            <Image
              src="/assets/xyra-logo.png"
              alt="Xyra"
              width={280}
              height={90}
              className="h-20 sm:h-24 w-auto brightness-0 invert"
              priority
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#waitlist"
              onClick={() => track("cta_click", { cta_location: "navbar_desktop", button_label: "Join Beta" })}
              className="font-[family-name:var(--font-jetbrains)] text-sm px-5 py-2.5 rounded-full border border-white/30 text-white hover:bg-white hover:text-black backdrop-blur-sm transition-all duration-500 tracking-wide"
            >
              Join Beta
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span
              className={`block w-5 h-[1.5px] bg-white transition-all duration-500 ${
                menuOpen ? "rotate-45 translate-y-[7.5px]" : ""
              }`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-white transition-all duration-500 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-white transition-all duration-500 ${
                menuOpen ? "-rotate-45 -translate-y-[4.5px]" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden bg-black/90 backdrop-blur-md border-b border-white/10"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              <a
                href="#waitlist"
                onClick={() => {
                  track("cta_click", { cta_location: "navbar_mobile", button_label: "Join Beta" });
                  setMenuOpen(false);
                }}
                className="font-[family-name:var(--font-jetbrains)] text-sm px-5 py-2.5 rounded-full border border-white/30 text-white hover:bg-white hover:text-black transition-colors tracking-wide text-center"
              >
                Join Beta
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
