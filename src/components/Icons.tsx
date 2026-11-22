type P = { size?: number; color?: string };

const stroke = (color: string, width = 2) => ({
  fill: "none",
  stroke: color,
  strokeWidth: width,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const CloseIcon = ({ size = 22, color = "#5E6472" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.4)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CheckIcon = ({ size = 22, color = "#fff" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 3)}>
    <path d="M5 12.5 10 17 19 7" />
  </svg>
);

export const LockIcon = ({ size = 22, color = "#6B7687" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const PlayIcon = ({ size = 28, color = "#fff" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </svg>
);

export const FlameIcon = ({ size = 18, color = "#E8590C" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1.2 2.6 2.3 2.8C11 8.6 11.2 5.6 12 3z" />
  </svg>
);

export const BoltIcon = ({ size = 18, color = "#C77C02" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

export const RefreshIcon = ({ size = 22, color = "#1F3A8A" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export const FileIcon = ({ size = 15, color = "#5E6472" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const SparkIcon = ({ size = 22, color = "#FFB020" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flex: `0 0 ${size}px`, marginTop: 2 }}>
    <path d="M12 2c.6 4.6 2.4 7.4 7.4 8.6.6.2.6 1 0 1.2C14.4 13 12.6 15.8 12 20.4c-.1.6-.9.6-1 0-.6-4.6-2.4-7.4-7.4-8.6-.6-.2-.6-1 0-1.2C8.6 9.4 10.4 6.6 11 2c.1-.6.9-.6 1 0z" />
  </svg>
);

export const TrophyIcon = ({ size = 22, color = "#6B7687" }: P) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  </svg>
);

export const StarBurst = () => (
  <svg aria-hidden="true" width="150" height="132" viewBox="0 0 150 132">
    <circle cx="75" cy="66" r="60" fill="#E6EBF7" />
    <path
      d="M75 26 L87 52 L115 55 L94 74 L100 102 L75 88 L50 102 L56 74 L35 55 L63 52 Z"
      fill="#FFB020"
      stroke="#1F3A8A"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <circle cx="22" cy="24" r="5" fill="#1F3A8A" />
    <circle cx="130" cy="20" r="4" fill="#FFB020" />
    <circle cx="136" cy="104" r="5" fill="#1F3A8A" />
    <circle cx="16" cy="100" r="4" fill="#FFB020" />
  </svg>
);

export const FlameBurst = () => (
  <svg aria-hidden="true" width="132" height="132" viewBox="0 0 132 132">
    <circle cx="66" cy="66" r="58" fill="#FFF0E3" />
    <path
      d="M66 22c3 10 22 18 22 44a22 22 0 0 1-44 0c0-10 5-16 10-21 1 7 5 11 10 12-3-13-1-26 2-35z"
      fill="#F76707"
      stroke="#C2410C"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M66 70c2 5 9 8 9 16a9 9 0 0 1-18 0c0-5 3-8 5-10 1 3 2 4 4 4-1-4-1-7 0-10z" fill="#FFB020" />
  </svg>
);

/** Decorative art for a course header: the logo's sparkles, tinted with the course color. */
export const CourseArt = ({ color = "#1F3A8A" }: { color?: string }) => (
  <svg aria-hidden="true" width="150" height="108" viewBox="0 0 150 108">
    <path d="M96 14c2.4 15 9 22 24 25-15 3-21.6 10-24 25-2.4-15-9-22-24-25 15-3 21.6-10 24-25z" fill={color} />
    <path d="M132 58c1.2 7 4.4 10.4 11 11.6-6.6 1.2-9.8 4.6-11 11.6-1.2-7-4.4-10.4-11-11.6 6.6-1.2 9.8-4.6 11-11.6z" fill="#FFB020" />
    <path d="M58 52c1 6 3.8 8.8 9.4 9.8-5.6 1-8.4 3.8-9.4 9.8-1-6-3.8-8.8-9.4-9.8 5.6-1 8.4-3.8 9.4-9.8z" fill="#FFB020" />
  </svg>
);
