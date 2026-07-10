import Hero from "@/components/Hero";
import Explainer from "@/components/Explainer";
import Navbar from "@/components/Navbar";
import Bouncer from "@/components/Bouncer";
import Footer from "@/components/Footer";

// The door IS the front page: you land mid-conversation with Xyra (the
// bouncer/waitlist), and the classic marketing story lives below — reached by
// clicking the Xyra logo in the navbar (href="#story") or just scrolling.
export default function Home() {
  return (
    <div className="bg-white min-h-screen">
      <Navbar />
      <Bouncer />
      <div id="story">
        <Hero />
      </div>
      <Explainer />
      <Footer />
    </div>
  );
}
