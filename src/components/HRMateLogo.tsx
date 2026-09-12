import React from "react";

interface HRMateLogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  textColor?: "dark" | "white";
  subtitle?: string;
}

export default function HRMateLogo({
  size = 40,
  className = "",
  withText = false,
  textColor = "dark",
  subtitle,
}: HRMateLogoProps) {
  const iconSize = size;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Modern Tech 'H' SVG Logo (FlavorFlow Style) */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{ filter: "drop-shadow(0 2px 6px rgba(11, 25, 44, 0.18))" }}
      >
        <defs>
          {/* Dark Midnight Squircle Background */}
          <linearGradient id="hrmate_bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B192C" />
            <stop offset="60%" stopColor="#0F2848" />
            <stop offset="100%" stopColor="#061220" />
          </linearGradient>

          {/* Left Pillar: Vibrant Royal/Cobalt Blue */}
          <linearGradient id="hrmate_blue" x1="14" y1="12" x2="26" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="35%" stopColor="#1E6FE0" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          {/* Right Pillar: Lush Emerald Mint */}
          <linearGradient id="hrmate_green" x1="38" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="60%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Connecting Fluid Flow Wave */}
          <linearGradient id="hrmate_flow" x1="16" y1="36" x2="48" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E6FE0" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Subtle 3D Rim Highlight */}
          <linearGradient id="hrmate_rim" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="white" stopOpacity="0.25" />
            <stop offset="50%" stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>

          {/* Ambient Glow */}
          <radialGradient id="hrmate_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0B192C" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Squircle App Container */}
        <rect width="64" height="64" rx="18" fill="url(#hrmate_bg)" />
        <rect width="64" height="64" rx="18" stroke="url(#hrmate_rim)" strokeWidth="1.2" />

        {/* Ambient Center Glow */}
        <circle cx="32" cy="32" r="22" fill="url(#hrmate_glow)" />

        {/* Left Pillar (Employee Core) */}
        <path
          d="M17 14C17 11.7909 18.7909 10 21 10C23.2091 10 25 11.7909 25 14V42C25 43.1 24.55 44.1 23.83 44.83C23.1 45.55 22.1 46 21 46C18.7909 46 17 44.2091 17 42V14Z"
          fill="url(#hrmate_blue)"
        />

        {/* Right Pillar (Enterprise Core) */}
        <path
          d="M39 22C39 20.9 39.45 19.9 40.17 19.17C40.9 18.45 41.9 18 43 18C45.2091 18 47 19.7909 47 22V50C47 52.2091 45.2091 54 43 54C40.7909 54 39 52.2091 39 50V22Z"
          fill="url(#hrmate_green)"
        />

        {/* Fluid Dynamic S-Curve Ribbon Flow */}
        <path
          d="M17 38C17 38 21 40 25 36C29 32 35 24 39 20C43 16 47 18 47 18C47 18 43 28 39 32C35 36 29 44 25 48C21 52 17 38 17 38Z"
          fill="url(#hrmate_flow)"
          opacity="0.95"
        />

        {/* Central Fluid Ribbon Accent Overlay */}
        <path
          d="M21 41C25.5 41 29 34 35 28C38.5 24.5 43 23 43 23"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.85"
        />
        <circle cx="32" cy="31" r="2" fill="white" />
      </svg>

      {/* Optional Brand Typography */}
      {withText && (
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center">
            <span
              className={`text-[17px] font-black tracking-tight ${
                textColor === "white" ? "text-white" : "text-[#0F172A]"
              }`}
            >
              HR<span className="text-[#1E6FE0]">Mate</span>
            </span>
          </div>
          {subtitle && (
            <span
              className={`text-[11px] font-semibold tracking-[0.05em] capitalize ${
                textColor === "white" ? "text-[#78B4FF]" : "text-[#64748B]"
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
