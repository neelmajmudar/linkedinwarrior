import dynamic from "next/dynamic";
import type { Metadata } from "next";
import Footer from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "LinkedInWarrior — AI-Powered LinkedIn Growth Engine",
  description:
    "Generate authentic LinkedIn posts in your voice, auto-engage with your audience, schedule content, and track analytics — all powered by AI.",
  keywords:
    "LinkedIn AI, AI post generator, LinkedIn growth, content automation, LinkedIn scheduling, AI ghostwriter, personal branding, LinkedIn engagement",
  openGraph: {
    title: "LinkedInWarrior — AI-Powered LinkedIn Growth Engine",
    description:
      "Generate authentic LinkedIn posts, auto-engage, and grow your network with AI that sounds like you.",
    type: "website",
  },
};

const HeroSection = dynamic(() => import("@/components/landing/hero-section"), {
  loading: () => (
    <section className="w-full min-h-[90vh] bg-white flex items-center justify-center">
      <div className="skeleton h-8 w-64 rounded-full" />
    </section>
  ),
});

const HowItWorks = dynamic(() => import("@/components/landing/how-it-works"), {
  loading: () => <div className="w-full h-[400px] bg-white" />,
});

const FeatureCards = dynamic(() => import("@/components/landing/feature-cards"), {
  loading: () => <div className="w-full h-[600px] bg-white" />,
});

const StatsSection = dynamic(() => import("@/components/landing/stats-section"), {
  loading: () => <div className="w-full h-[400px] bg-white" />,
});

const CTASection = dynamic(() => import("@/components/landing/cta-section"), {
  loading: () => <div className="w-full h-[300px]" />,
});

export default function HomePage() {
  return (
    <main className="min-h-screen w-full bg-white">
      <HeroSection />

      <section id="how-it-works">
        <HowItWorks />
      </section>

      <section
        id="features"
        className="w-full px-8 md:px-16 lg:px-24 pt-8 md:pt-16 pb-24 md:pb-32 bg-white"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-1 md:gap-3 mb-10 md:mb-16">
            <h2 className="font-normal text-3xl md:text-5xl tracking-[-0.02em] text-[#1a1a1a] text-center">
              Everything You Need to Win on LinkedIn
            </h2>
            <p className="text-center text-base md:text-lg text-gray-500 mx-auto max-w-[540px]">
              From AI-powered post generation to automated engagement — one
              platform, zero compromises.
            </p>
          </div>
          <FeatureCards />
        </div>
      </section>

      <StatsSection />
      <CTASection />

      {/* Footer is static — rendered as RSC, no JS shipped */}
      <Footer />
    </main>
  );
}
