import Hero from "@/components/Hero";
import Explainer from "@/components/Explainer";
import Navbar from "@/components/Navbar";
import Bouncer from "@/components/Bouncer";
import Footer from "@/components/Footer";

// The door IS the front page: you land mid-conversation with Xyra (the
// bouncer/waitlist). Below it: the explainer ("what Xyra is" — reached by the
// bouncer's "click here to learn" link and the navbar logo, both → #learn),
// then the Hero as the CLOSING screen (a final brand + CTA, id="story").
export default function Home() {
  return (
    <div className="bg-white min-h-screen">
      <Navbar />
      <Bouncer />
      <div id="learn">
        <Explainer />
      </div>
      <div id="story">
        <Hero />
      </div>
      <Footer />
    </div>
  );
}
