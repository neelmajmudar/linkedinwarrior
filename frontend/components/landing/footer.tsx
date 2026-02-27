import { memo } from "react";
import Link from "next/link";

const Footer = memo(function Footer() {
  return (
    <footer className="w-full bg-[#69494a] px-8 md:px-16 lg:px-24 py-16 md:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          {/* Brand */}
          <div className="md:mr-24">
            <div className="flex items-center gap-2 text-base font-normal text-white mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  suppressHydrationWarning
                >
                  <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                  <path d="M13 19l6-6" />
                  <path d="M16 16l4 4" />
                  <path d="M19 21l2-2" />
                </svg>
              </div>
              <span className="text-lg font-medium tracking-tight">LinkedInWarrior</span>
            </div>
            <p className="text-sm max-w-48" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
              AI-powered LinkedIn growth engine. Generate, engage, and analyze — all in your
              authentic voice.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-24 gap-y-8 flex-1 justify-between max-w-[500px]">
            <div>
              <div className="text-sm font-normal text-white mb-3">Product</div>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="#features"
                    className="text-sm hover:text-white transition-colors"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="#stats"
                    className="text-sm hover:text-white transition-colors"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    Results
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className="text-sm hover:text-white transition-colors"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-normal text-white mb-3">Social</div>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://linkedin.com"
                    className="text-sm hover:text-white transition-colors"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://x.com"
                    className="text-sm hover:text-white transition-colors"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Twitter
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div
          className="pt-8 text-sm"
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            color: "rgba(255, 255, 255, 0.4)",
          }}
        >
          &copy; {new Date().getFullYear()} LinkedInWarrior. All rights reserved.
        </div>
      </div>
    </footer>
  );
});

export default Footer;
