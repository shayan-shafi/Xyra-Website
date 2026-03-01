import ScrollShowcase from "@/components/ScrollShowcase";
import Navbar from "@/components/Navbar";
import Waitlist from "@/components/Waitlist";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="bg-white min-h-screen">
      <ScrollShowcase />
      <Navbar />
      <Waitlist />
      <Footer />
    </div>
  );
}
