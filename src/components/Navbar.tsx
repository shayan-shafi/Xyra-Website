"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type NavTheme = "transparent" | "light" | "dark";

export default function Navbar() {
  const [theme, setTheme] = useState<NavTheme>("transparent");
  const [menuOpen, setMenuOpen] = useState(false);

  const updateTheme = useCallback(() => {
    const scrollY = window.scrollY;

    // Not scrolled — transparent over the hero
    if (scrollY <= 40) {
      setTheme("transparent");
      return;
    }

    // Check if the navbar overlaps the waitlist section (dark video)
    const waitlist = document.getElementById("waitlist");
    if (waitlist) {
      const rect = waitlist.getBoundingClientRect();
      // If the top of the waitlist section is at or above the navbar height
      if (rect.top <= 96) {
        setTheme("dark");
        return;
      }
    }

    // Otherwise we're in the light middle sections
    setTheme("light");
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", updateTheme, { passive: true });
    updateTheme();
    return () => window.removeEventListener("scroll", updateTheme);
  }, [updateTheme]);

  const isDark = theme === "transparent" || theme === "dark";

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        theme === "transparent"
          ? "bg-transparent"
          : theme === "light"
            ? "bg-white/90 backdrop-blur-md border-b border-ink-faint/20"
            : "bg-black/90 backdrop-blur-md border-b border-white/10"
      }`}
    >
      <div className="mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex h-20 sm:h-24 items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3">
            <Image
              src="/assets/xyra-logo.png"
              alt="Xyra"
              width={280}
              height={90}
              className={`h-20 sm:h-24 w-auto transition-all duration-500 ${
                isDark ? "brightness-0 invert" : ""
              }`}
              priority
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#demo"
              className={`font-[family-name:var(--font-eb-garamond)] transition-colors duration-500 text-[17px] ${
                isDark
                  ? "text-white/70 hover:text-white"
                  : "text-ink-light hover:text-ink"
              }`}
            >
              Demo
            </a>
            <a
              href="#solution"
              className={`font-[family-name:var(--font-eb-garamond)] transition-colors duration-500 text-[17px] ${
                isDark
                  ? "text-white/70 hover:text-white"
                  : "text-ink-light hover:text-ink"
              }`}
            >
              The Solution
            </a>
            <a
              href="#features"
              className={`font-[family-name:var(--font-eb-garamond)] transition-colors duration-500 text-[17px] ${
                isDark
                  ? "text-white/70 hover:text-white"
                  : "text-ink-light hover:text-ink"
              }`}
            >
              Features
            </a>
            <a
              href="#waitlist"
              className={`font-[family-name:var(--font-jetbrains)] text-sm px-5 py-2.5 rounded-full transition-all duration-500 tracking-wide ${
                isDark
                  ? "border border-white/30 text-white hover:bg-white hover:text-black backdrop-blur-sm"
                  : "bg-ink text-cream hover:bg-ink-light"
              }`}
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
              className={`block w-5 h-[1.5px] transition-all duration-500 ${
                isDark ? "bg-white" : "bg-ink"
              } ${menuOpen ? "rotate-45 translate-y-[7.5px]" : ""}`}
            />
            <span
              className={`block w-5 h-[1.5px] transition-all duration-500 ${
                isDark ? "bg-white" : "bg-ink"
              } ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-5 h-[1.5px] transition-all duration-500 ${
                isDark ? "bg-white" : "bg-ink"
              } ${menuOpen ? "-rotate-45 -translate-y-[4.5px]" : ""}`}
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
            className={`md:hidden overflow-hidden backdrop-blur-md border-b ${
              isDark
                ? "bg-black/90 border-white/10"
                : "bg-white/95 border-ink-faint/20"
            }`}
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              {["demo", "solution", "features"].map((section) => (
                <a
                  key={section}
                  href={`#${section}`}
                  onClick={() => setMenuOpen(false)}
                  className={`font-[family-name:var(--font-eb-garamond)] transition-colors text-lg py-1 capitalize ${
                    isDark
                      ? "text-white/70 hover:text-white"
                      : "text-ink-light hover:text-ink"
                  }`}
                >
                  {section === "solution"
                    ? "The Solution"
                    : section.charAt(0).toUpperCase() + section.slice(1)}
                </a>
              ))}
              <a
                href="#waitlist"
                onClick={() => setMenuOpen(false)}
                className={`font-[family-name:var(--font-jetbrains)] text-sm px-5 py-2.5 rounded-full transition-colors tracking-wide text-center mt-2 ${
                  isDark
                    ? "border border-white/30 text-white hover:bg-white hover:text-black"
                    : "bg-ink text-cream hover:bg-ink-light"
                }`}
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
