import React from "react";

export default function TopsLogo({
  className = "h-9 w-auto",
  showOutline = false,
}: {
  className?: string;
  showOutline?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 160 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer White Glow Outline if needed */}
      {showOutline && (
        <rect
          x="3"
          y="3"
          width="154"
          height="64"
          rx="32"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3.5"
        />
      )}

      {/* Main Red Oval Pill */}
      <rect
        x="6"
        y="6"
        width="148"
        height="58"
        rx="29"
        fill="#D1122A"
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />

      {/* Leaf on top of letter p */}
      <path
        d="M96 16C97 10 105 8 108 12C108 17 101 19 96 16Z"
        fill="#22C55E"
      />
      <path
        d="M98 17C101 13 107 14 107 18C104 21 99 20 98 17Z"
        fill="#16A34A"
      />

      {/* Crisp White "Tops" typography */}
      <text
        x="78"
        y="45"
        fill="#FFFFFF"
        fontFamily="'Brush Script MT', 'Lobster', 'Inter', cursive, sans-serif"
        fontSize="35"
        fontWeight="bold"
        fontStyle="italic"
        textAnchor="middle"
        letterSpacing="-0.5px"
      >
        Tops
      </text>

      {/* ® Symbol */}
      <text
        x="122"
        y="28"
        fill="#FFFFFF"
        fontFamily="sans-serif"
        fontSize="8"
        fontWeight="bold"
      >
        ®
      </text>
    </svg>
  );
}
