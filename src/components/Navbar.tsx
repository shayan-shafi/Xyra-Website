"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md border-b border-ink-faint/20"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12">
        <div className="flex h-20 sm:h-24 items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3">
            <Image
              src="/assets/xyra-logo.png"
              alt="Xyra"
              width={280}
              height={90}
              className="h-20 sm:h-24 w-auto"
              priority
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#demo"
              className="font-[family-name:var(--font-eb-garamond)] text-ink-light hover:text-ink transition-colors text-[17px]"
            >
              Demo
            </a>
            <a
              href="#solution"
              className="font-[family-name:var(--font-eb-garamond)] text-ink-light hover:text-ink transition-colors text-[17px]"
            >
              The Solution
            </a>
            <a
              href="#features"
              className="font-[family-name:var(--font-eb-garamond)] text-ink-light hover:text-ink transition-colors text-[17px]"
            >
              Features
            </a>
            <a
              href="#waitlist"
              className="font-[family-name:var(--font-jetbrains)] text-sm px-5 py-2.5 bg-ink text-cream rounded-full hover:bg-ink-light transition-colors tracking-wide"
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
              className={`block w-5 h-[1.5px] bg-ink transition-all duration-300 ${
                menuOpen ? "rotate-45 translate-y-[7.5px]" : ""
              }`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-ink transition-all duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-ink transition-all duration-300 ${
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
            className="md:hidden bg-white/95 backdrop-blur-md border-b border-ink-faint/20 overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              {["demo", "solution", "features"].map((section) => (
                <a
                  key={section}
                  href={`#${section}`}
                  onClick={() => setMenuOpen(false)}
                  className="font-[family-name:var(--font-eb-garamond)] text-ink-light hover:text-ink transition-colors text-lg py-1 capitalize"
                >
                  {section === "solution"
                    ? "The Solution"
                    : section.charAt(0).toUpperCase() + section.slice(1)}
                </a>
              ))}
              <a
                href="#waitlist"
                onClick={() => setMenuOpen(false)}
                className="font-[family-name:var(--font-jetbrains)] text-sm px-5 py-2.5 bg-ink text-cream rounded-full hover:bg-ink-light transition-colors tracking-wide text-center mt-2"
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
