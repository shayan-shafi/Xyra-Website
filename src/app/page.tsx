import BrainHero from "@/components/BrainHero";
import Explainer from "@/components/Explainer";
import Footer from "@/components/Footer";
import HowItStarts from "@/components/HowItStarts";
import LogoMarquee from "@/components/LogoMarquee";

// Top to bottom: the brain (the app's world, live: tap a node and its file
// opens), the "used by legends at" logo rows, how it starts (#how: the first
// run in three steps), then the explainer (#learn):
// just vent → the phone on its canvas, floating screens and stickers → socials
// → the ask. (The Bouncer conversation and the laptop scene are off the page;
// the code stays.)
export default function Home() {
  return (
    <div className="xyra-canvas min-h-screen">
      <BrainHero />
      <LogoMarquee />
      <HowItStarts />
      <div id="learn">
        <Explainer />
      </div>
      <Footer />
    </div>
  );
}
