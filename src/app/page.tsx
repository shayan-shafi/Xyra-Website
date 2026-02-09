import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Demo from "@/components/Demo";
import Solution from "@/components/Solution";
import Features from "@/components/Features";
import Waitlist from "@/components/Waitlist";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="bg-white min-h-screen">
      <Navbar />
      <Hero />
      <Solution />
      <Features />
      <Demo />
      <Waitlist />
      <Footer />
    </div>
  );
}
