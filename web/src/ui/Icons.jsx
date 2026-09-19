import React from 'react';

const S = ({ children, size = 18, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const Icons = {
  home: (p) => (
    <S {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </S>
  ),
  clock: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </S>
  ),
  users: (p) => (
    <S {...p}>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.87" />
      <path d="M16 4.2a3.2 3.2 0 0 1 0 5.6" />
    </S>
  ),
  user: (p) => (
    <S {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </S>
  ),
  calendar: (p) => (
    <S {...p}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </S>
  ),
  calendarCheck: (p) => (
    <S {...p}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" />
    </S>
  ),
  check: (p) => (
    <S {...p}>
      <path d="m4 12.5 5 5L20 6.5" />
    </S>
  ),
  checkCircle: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </S>
  ),
  x: (p) => (
    <S {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </S>
  ),
  xCircle: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </S>
  ),
  bell: (p) => (
    <S {...p}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18.5a2.2 2.2 0 0 0 4 0" />
    </S>
  ),
  bellRing: (p) => (
    <S {...p}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18.5a2.2 2.2 0 0 0 4 0M18.5 4.5 20 3M5.5 4.5 4 3" />
    </S>
  ),
  search: (p) => (
    <S {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </S>
  ),
  plus: (p) => (
    <S {...p}>
      <path d="M12 5v14M5 12h14" />
    </S>
  ),
  minus: (p) => (
    <S {...p}>
      <path d="M5 12h14" />
    </S>
  ),
  chevronRight: (p) => (
    <S {...p}>
      <path d="m9 5 7 7-7 7" />
    </S>
  ),
  chevronLeft: (p) => (
    <S {...p}>
      <path d="m15 5-7 7 7 7" />
    </S>
  ),
  chevronDown: (p) => (
    <S {...p}>
      <path d="m5 9 7 7 7-7" />
    </S>
  ),
  menu: (p) => (
    <S {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </S>
  ),
  settings: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v0a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </S>
  ),
  logout: (p) => (
    <S {...p}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </S>
  ),
  pin: (p) => (
    <S {...p}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </S>
  ),
  fingerprint: (p) => (
    <S {...p}>
      <path d="M12 3a8 8 0 0 0-8 8v1" />
      <path d="M20 12a8 8 0 0 0-3.2-6.4" />
      <path d="M7 12a5 5 0 0 1 10 0v2.5" />
      <path d="M12 12v4" />
      <path d="M15.5 19.5A9 9 0 0 0 17 15" />
      <path d="M8 20.5A11 11 0 0 1 7 16" />
    </S>
  ),
  face: (p) => (
    <S {...p}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M9.5 14.5a3.6 3.6 0 0 0 5 0" />
    </S>
  ),
  shield: (p) => (
    <S {...p}>
      <path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.4-3.6" />
    </S>
  ),
  document: (p) => (
    <S {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </S>
  ),
  folder: (p) => (
    <S {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </S>
  ),
  idCard: (p) => (
    <S {...p}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16.2a3.6 3.6 0 0 1 6 0M14 10h4M14 13.5h3" />
    </S>
  ),
  target: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </S>
  ),
  trending: (p) => (
    <S {...p}>
      <path d="m3 16 5.5-5.5 3.5 3.5L21 5" />
      <path d="M15 5h6v6" />
    </S>
  ),
  chart: (p) => (
    <S {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </S>
  ),
  pie: (p) => (
    <S {...p}>
      <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
      <path d="M15 3.6A9 9 0 0 1 20.4 9H15V3.6Z" />
    </S>
  ),
  star: (p) => (
    <S {...p}>
      <path d="m12 4 2.4 5 5.6.7-4 3.9 1 5.5-5-2.8-5 2.8 1-5.5-4-3.9 5.6-.7L12 4Z" />
    </S>
  ),
  heart: (p) => (
    <S {...p}>
      <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />
    </S>
  ),
  chat: (p) => (
    <S {...p}>
      <path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z" />
    </S>
  ),
  megaphone: (p) => (
    <S {...p}>
      <path d="M4 10v4a2 2 0 0 0 2 2h1l9 4V4L7 8H6a2 2 0 0 0-2 2Z" />
      <path d="M19 9a3 3 0 0 1 0 6" />
    </S>
  ),
  ticket: (p) => (
    <S {...p}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8Z" />
      <path d="M13 6v12" strokeDasharray="2 2.5" />
    </S>
  ),
  device: (p) => (
    <S {...p}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="3" />
      <path d="M10.5 18.5h3" />
    </S>
  ),
  list: (p) => (
    <S {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </S>
  ),
  filter: (p) => (
    <S {...p}>
      <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />
    </S>
  ),
  download: (p) => (
    <S {...p}>
      <path d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />
    </S>
  ),
  upload: (p) => (
    <S {...p}>
      <path d="M12 20V9m0 0 4 4m-4-4-4 4M4 5h16" />
    </S>
  ),
  edit: (p) => (
    <S {...p}>
      <path d="M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16v4Z" />
    </S>
  ),
  trash: (p) => (
    <S {...p}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </S>
  ),
  refresh: (p) => (
    <S {...p}>
      <path d="M20 11a8 8 0 1 0-1.6 5.6" />
      <path d="M20 5v6h-6" />
    </S>
  ),
  grid: (p) => (
    <S {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </S>
  ),
  building: (p) => (
    <S {...p}>
      <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M14 10h4a2 2 0 0 1 2 2v9M2 21h20M7.5 8h3M7.5 12h3M7.5 16h3M17 14h1M17 17.5h1" />
    </S>
  ),
  briefcase: (p) => (
    <S {...p}>
      <rect x="3" y="7.5" width="18" height="12.5" rx="3" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12.5h18" />
    </S>
  ),
  money: (p) => (
    <S {...p}>
      <rect x="2.5" y="6" width="19" height="12" rx="3" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 12h.01M18 12h.01" />
    </S>
  ),
  award: (p) => (
    <S {...p}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" />
    </S>
  ),
  qr: (p) => (
    <S {...p}>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 20.5h1.5" />
    </S>
  ),
  moon: (p) => (
    <S {...p}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </S>
  ),
  sun: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </S>
  ),
  globe: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
    </S>
  ),
  swap: (p) => (
    <S {...p}>
      <path d="M7 4 4 7l3 3M4 7h11a4 4 0 0 1 4 4v1" />
      <path d="m17 20 3-3-3-3M20 17H9a4 4 0 0 1-4-4v-1" />
    </S>
  ),
  alert: (p) => (
    <S {...p}>
      <path d="M12 4 2.8 20h18.4L12 4Z" />
      <path d="M12 10v4M12 17.5h.01" />
    </S>
  ),
  info: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </S>
  ),
  lock: (p) => (
    <S {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </S>
  ),
  eye: (p) => (
    <S {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </S>
  ),
  eyeOff: (p) => (
    <S {...p}>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.4 4.1M6.5 7.9A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5a9.7 9.7 0 0 0 3.6-.7" />
    </S>
  ),
  mail: (p) => (
    <S {...p}>
      <rect x="3" y="5.5" width="18" height="13" rx="3" />
      <path d="m4 8 8 5 8-5" />
    </S>
  ),
  phone: (p) => (
    <S {...p}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
    </S>
  ),
  copy: (p) => (
    <S {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5" />
    </S>
  ),
  share: (p) => (
    <S {...p}>
      <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </S>
  ),
  sitemap: (p) => (
    <S {...p}>
      <rect x="9" y="3" width="6" height="5" rx="1.5" />
      <rect x="2.5" y="16" width="6" height="5" rx="1.5" />
      <rect x="15.5" y="16" width="6" height="5" rx="1.5" />
      <path d="M12 8v4M5.5 16v-2h13v2" />
    </S>
  ),
  history: (p) => (
    <S {...p}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V9H8M12 8v4.5l3 1.8" />
    </S>
  ),
  sparkle: (p) => (
    <S {...p}>
      <path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
      <path d="M18.5 15.5 19.4 18l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z" />
    </S>
  ),
  coffee: (p) => (
    <S {...p}>
      <path d="M4 8h13v5.5a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 13.5V8Z" />
      <path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17M3 21h16" />
    </S>
  ),
  mapPin: (p) => (
    <S {...p}>
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" />
    </S>
  ),
  more: (p) => (
    <S {...p}>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </S>
  ),
  play: (p) => (
    <S {...p}>
      <path d="M7 4.5 19 12 7 19.5v-15Z" />
    </S>
  ),
  pause: (p) => (
    <S {...p}>
      <path d="M9 5v14M15 5v14" />
    </S>
  ),
  layers: (p) => (
    <S {...p}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3.5 12.5 8.5 4.7 8.5-4.7M3.5 16.8 12 21.5l8.5-4.7" />
    </S>
  ),
  route: (p) => (
    <S {...p}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H14a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7h5.5" />
    </S>
  ),
  printer: (p) => (
    <S {...p}>
      <path d="M7 9V3.5h10V9" />
      <path d="M6 18H4.5A1.5 1.5 0 0 1 3 16.5V12a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4.5A1.5 1.5 0 0 1 19.5 18H18" />
      <rect x="7" y="14" width="10" height="6.5" rx="1" />
    </S>
  ),
  clip: (p) => (
    <S {...p}>
      <path d="M20 11.5 12.2 19.3a4.6 4.6 0 0 1-6.5-6.5l7.9-7.9a3.1 3.1 0 0 1 4.4 4.4l-7.9 7.9a1.6 1.6 0 0 1-2.2-2.2l7.2-7.2" />
    </S>
  ),
  cake: (p) => (
    <S {...p}>
      <path d="M4 20.5h16V14a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6.5Z" />
      <path d="M4 16.5c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2" />
      <path d="M12 12V9M9.4 12V9.8M14.6 12V9.8" />
      <path d="M12 6.6c.9-.8.9-1.7 0-2.6-.9.9-.9 1.8 0 2.6Z" />
    </S>
  ),
  trophy: (p) => (
    <S {...p}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H5.5v1.2A3.3 3.3 0 0 0 8.8 10M16 5.5h2.5v1.2A3.3 3.3 0 0 1 15.2 10" />
      <path d="M12 13v3.5M9 20h6M10 20l.4-3.5h3.2L14 20" />
    </S>
  ),
  plane: (p) => (
    <S {...p}>
      <path d="M10.3 13.7 3 11.4l1.6-1.4 5.6.6 3.4-3.4a2 2 0 0 1 2.8 2.8l-3.4 3.4.6 5.6-1.4 1.6-2.3-7.3Z" />
    </S>
  ),
  cash: (p) => (
    <S {...p}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </S>
  ),
  lifebuoy: (p) => (
    <S {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="m5.6 5.6 3.8 3.8M14.6 14.6l3.8 3.8M18.4 5.6l-3.8 3.8M9.4 14.6l-3.8 3.8" />
    </S>
  )
};

// Friendly aliases so either spelling works at call sites.
Icons.sparkles = Icons.sparkle;
Icons.idcard = Icons.idCard;

export function Icon({ name, size = 18, className = '', ...rest }) {
  const Cmp = Icons[name] || Icons.info;
  return (
    <span className={`inline-flex ${className}`} style={{ color: 'inherit' }} {...rest}>
      <Cmp size={size} />
    </span>
  );
}
