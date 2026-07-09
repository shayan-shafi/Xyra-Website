import Hero from "@/components/Hero";
import Explainer from "@/components/Explainer";
import Navbar from "@/components/Navbar";
import Bouncer from "@/components/Bouncer";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="bg-white min-h-screen">
      <Hero />
      <Explainer />
      <Navbar />
      <Bouncer />
      <Footer />
    </div>
  );
}
