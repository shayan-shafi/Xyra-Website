import DesktopHero from "@/components/DesktopHero";
import Explainer from "@/components/Explainer";
import Footer from "@/components/Footer";

// heyclicky-style desktop hero: dotted-grid canvas, draggable mac windows
// playing product videos on hover, and a single email field → waitlist.
// (The Bouncer conversation is off the page for now — the code stays; it's
// moving into the app later.) Below the hero: the explainer (#learn), reached
// from the hero's menu bar.
export default function Home() {
  return (
    <div className="bg-white min-h-screen">
      <DesktopHero />
      <div id="learn">
        <Explainer />
      </div>
      <Footer />
    </div>
  );
}
