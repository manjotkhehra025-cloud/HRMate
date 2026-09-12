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
      viewBox="0 0 200 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Glow / Outline */}
      {showOutline && (
        <ellipse
          cx="100"
          cy="55"
          rx="96"
          ry="51"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4"
        />
      )}

      {/* Main Crimson Red Oval */}
      <ellipse
        cx="100"
        cy="55"
        rx="92"
        ry="48"
        fill="#D61827"
      />

      {/* Double Leaves above letter 'p' */}
      <path
        d="M124 35C124 23 136 21 138 29C138 38 128 41 124 35Z"
        fill="#0EA953"
      />
      <path
        d="M129 36C134 26 146 27 144 37C140 43 131 43 129 36Z"
        fill="#8BC53F"
      />

      {/* Tops Lettering */}
      <g fill="#FFFFFF">
        {/* Letter T */}
        <path d="M48 42C44 42 41 43 41 40C41 37 47 36 57 34C68 32 83 29 86 31C88 33 87 36 82 37C76 38 73 39 70 41L59 74C58 77 56 78 53 78C51 78 50 76 51 73L59 47C55 47 51 45 48 42Z" />
        {/* Letter o */}
        <path d="M79 56C77 50 81 44 89 42C97 40 103 44 105 51C107 58 103 64 95 66C86 68 81 64 79 56ZM94 48C90 49 88 53 89 58C90 62 93 63 96 62C100 61 101 57 100 52C99 48 97 47 94 48Z" />
        {/* Letter p */}
        <path d="M106 50C107 45 111 41 117 39C122 37 127 39 128 44C130 49 128 55 125 59C121 64 116 64 113 61L107 79C106 82 104 83 101 83C99 83 99 81 100 78L108 51C107 50 106 50 106 50ZM118 45C115 46 113 49 114 54C115 57 117 58 119 57C122 56 123 53 122 49C121 46 119 45 118 45Z" />
        {/* Letter s */}
        <path d="M136 49C134 47 136 44 140 43C145 42 150 43 151 46C152 50 148 52 142 54C137 56 135 58 136 61C137 64 141 64 146 63C148 62 150 60 151 61C152 62 151 64 148 66C143 68 136 67 134 63C132 58 135 54 140 52C145 50 147 49 146 47C145 45 142 45 139 46C137 47 136 48 136 49Z" />
        {/* Underline Swirl */}
        <path d="M52 79C75 75 110 70 145 68C149 68 152 70 149 72C130 76 96 82 56 87C51 88 49 85 52 79Z" />
        {/* ® Registered Trademark */}
        <circle cx="156" cy="38" r="4.5" fill="none" stroke="#FFFFFF" strokeWidth="1" />
        <text x="156" y="41" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" fill="#FFFFFF">R</text>
      </g>
    </svg>
  );
}
