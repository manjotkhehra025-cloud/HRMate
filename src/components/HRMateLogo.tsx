import React from "react";

interface HRMateLogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  textColor?: "dark" | "white";
  subtitle?: string;
}

export default function HRMateLogo({
  size = 38,
  className = "",
  withText = false,
  textColor,
  subtitle,
}: HRMateLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* High-Resolution Exact Option 4 Brand Icon (FlavorFlow Style) */}
      <img
        src="/icon.png"
        alt="HRMate Logo"
        width={size}
        height={size}
        className="shrink-0 rounded-[11px] object-contain shadow-sm transition-transform duration-200 group-hover:scale-105"
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
        loading="eager"
      />

      {/* Brand Typography */}
      {withText && (
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center">
            <span
              className={`text-[16.5px] font-black tracking-tight ${
                textColor === "white"
                  ? "text-white"
                  : textColor === "dark"
                  ? "text-[#0F172A] dark:text-white"
                  : "text-[#0F172A] dark:text-white"
              }`}
            >
              HR<span className="text-[#1E6FE0]">Mate</span>
            </span>
          </div>
          {subtitle && (
            <span
              className={`text-[11px] font-semibold tracking-[0.04em] capitalize ${
                textColor === "white"
                  ? "text-[#78B4FF]"
                  : "text-[#64748B] dark:text-[#94A3B8]"
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
