import HeroCarousel from "../components/HeroCarousel";
import ScrollIndicator from "../components/ScrollIndicator";

export default function Home() {
  return (
    <section id="home" aria-label="Home" className="relative">
      <HeroCarousel />
      <ScrollIndicator targetId="news" />
    </section>
  );
}
