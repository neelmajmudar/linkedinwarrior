"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PenTool,
  FileText,
  Calendar,
  MessageSquare,
  Sparkles,
  BarChart3,
  Brain,
  ArrowRight,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  page: string | null;
}

const tourSteps: TourStep[] = [
  {
    title: "Building Your Voice Profile",
    description:
      "We're analyzing your LinkedIn posts to learn your unique writing style. This takes a few minutes — let's explore what you can do!",
    icon: Brain,
    page: null,
  },
  {
    title: "Generate Posts",
    description:
      "Describe a topic and we'll craft a LinkedIn post that sounds exactly like you. Choose from different formats — thought leadership, storytelling, tips, and more.",
    icon: PenTool,
    page: "/dashboard/generate",
  },
  {
    title: "Your Content Library",
    description:
      "All your generated posts live here. Edit, schedule, or publish them directly to LinkedIn with one click.",
    icon: FileText,
    page: "/dashboard/posts",
  },
  {
    title: "Content Calendar",
    description:
      "Plan your posting schedule visually. See what's coming up and maintain a consistent presence on LinkedIn.",
    icon: Calendar,
    page: "/dashboard/calendar",
  },
  {
    title: "Smart Engagement",
    description:
      "Set your topics of interest and we'll find relevant posts for you to engage with. AI-crafted comments help you build meaningful connections.",
    icon: MessageSquare,
    page: "/dashboard/engage",
  },
  {
    title: "Creator Research",
    description:
      "Analyze top creators in your niche. Discover what content strategies work and get data-driven inspiration.",
    icon: Sparkles,
    page: "/dashboard/research",
  },
  {
    title: "Analytics",
    description:
      "Track impressions, engagement rates, and follower growth. See which posts perform best and optimize your strategy.",
    icon: BarChart3,
    page: "/dashboard/analytics",
  },
];

interface GuidedTourProps {
  onComplete: () => void;
  personaReady: boolean;
  personaStatus?: string;
}

export default function GuidedTour({
  onComplete,
  personaReady,
  personaStatus,
}: GuidedTourProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("linkedinwarrior-tour-step");
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });

  useEffect(() => {
    localStorage.setItem("linkedinwarrior-tour-step", currentStep.toString());
  }, [currentStep]);

  useEffect(() => {
    const step = tourSteps[currentStep];
    if (step?.page) {
      router.push(step.page);
    }
  }, [currentStep, router]);

  const handleFinish = useCallback(() => {
    localStorage.removeItem("linkedinwarrior-tour-step");
    localStorage.removeItem("linkedinwarrior-tour-active");
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleFinish();
    }
  }, [currentStep, handleFinish]);

  const step = tourSteps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/15 backdrop-blur-[1px] pointer-events-auto" />

      {/* Tour Card */}
      <div
        key={currentStep}
        className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 overflow-hidden pointer-events-auto animate-fade-in"
      >
        {/* Skip button */}
        <button
          onClick={handleFinish}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
          title="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-warm-50 border border-warm-200 mb-6">
            <Icon className="h-8 w-8 text-warm-600" />
          </div>

          <h2 className="text-xl font-semibold text-[#1a1a1a] mb-3">
            {step.title}
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-6 bg-warm-500"
                    : i < currentStep
                    ? "w-1.5 bg-warm-300"
                    : "w-1.5 bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {currentStep + 1} of {tourSteps.length}
            </span>
            <button
              onClick={handleNext}
              className="btn-primary px-6 py-2.5 inline-flex items-center gap-2 text-sm"
            >
              {isLastStep ? "Get Started" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Processing status bar */}
        <div
          className={`px-6 py-3 border-t transition-colors ${
            personaReady
              ? "bg-green-50 border-green-100"
              : "bg-warm-50 border-warm-100"
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-xs">
            {personaReady ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                <span className="text-green-700 font-medium">
                  Voice profile ready!
                </span>
              </>
            ) : (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-warm-500" />
                <span className="text-warm-600">
                  {personaStatus || "Building your voice profile..."}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
