import type { WebModelVendor } from "../lib/snapshot";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 16 16">
        <rect x="1.5" y="10" width="3" height="4" rx="0.6" fill="currentColor" opacity="0.5" />
        <rect x="6.5" y="7" width="3" height="7" rx="0.6" fill="currentColor" opacity="0.75" />
        <rect x="11.5" y="3" width="3" height="11" rx="0.6" fill="var(--accent)" />
        <line x1="0.5" y1="14.5" x2="15.5" y2="14.5" stroke="currentColor" strokeWidth="0.6" opacity="0.35" />
      </svg>
    </span>
  );
}

export function HumanIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-fixed">
      <circle cx="12" cy="7.5" r="3.8" fill="var(--ink-3)" />
      <path d="M3.6 22 C3.6 15.5 8 13 12 13 C16 13 20.4 15.5 20.4 22 Z" fill="var(--ink-3)" />
    </svg>
  );
}

export function VendorIcon({ vendor, size = 14 }: { vendor: WebModelVendor; size?: number }) {
  const gradientId = `vendor-${vendor}-${size}`;
  if (vendor === "google") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-fixed">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4279d0" />
            <stop offset="0.55" stopColor="#9b72cb" />
            <stop offset="1" stopColor="#d96570" />
          </linearGradient>
        </defs>
        <path d="M12 2 C12 7 17 12 22 12 C17 12 12 17 12 22 C12 17 7 12 2 12 C7 12 12 7 12 2 Z" fill={`url(#${gradientId})`} />
      </svg>
    );
  }
  if (vendor === "openai") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-fixed">
        <circle cx="12" cy="12" r="9" fill="#10a37f" />
        <path d="M12 5.6l5.5 3.2v6.4L12 18.4l-5.5-3.2V8.8L12 5.6zm0 3.1l-2.8 1.6v3.3l2.8 1.7 2.8-1.7v-3.3L12 8.7z" fill="#fff" opacity="0.86" />
      </svg>
    );
  }
  if (vendor === "anthropic") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-fixed">
        <path fill="#c75a16" d="M6.5 4h3.2l5.4 16H11.8l-1.1-3.4H5.2L4.1 20H1zm.5 9.2h2.9L7.9 8.5zM14.2 4h3.1l5.5 16h-3.1z" />
      </svg>
    );
  }
  if (vendor === "xai") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-fixed">
        <path fill="#1a1a17" d="M3 3h3.2l4 5.4L14.2 3H17l-5.4 7.2L17.4 21H14l-4-5.6L6 21H3.2l5.6-7.6L3 3z" />
      </svg>
    );
  }
  if (vendor === "meta") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-fixed">
        <path fill="#0866ff" d="M5 7c2 0 3.5 1.5 5 4.5L12 14c1.5-2.5 3-4 5-4s3 1.5 3 3-1.5 3-3 3-3-1.5-5-5l-2-3c-1.5-2.5-3-4-5-4S2 5.5 2 7s1 3 3 3z" fillOpacity="0.85" />
      </svg>
    );
  }
  if (vendor === "mistral") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-fixed">
        <rect x="2" y="3" width="4" height="4" fill="#000" />
        <rect x="6" y="3" width="4" height="4" fill="#f7d046" />
        <rect x="18" y="3" width="4" height="4" fill="#000" />
        <rect x="2" y="10" width="4" height="4" fill="#000" />
        <rect x="6" y="10" width="4" height="4" fill="#f2a73d" />
        <rect x="10" y="10" width="4" height="4" fill="#ee792f" />
        <rect x="14" y="10" width="4" height="4" fill="#f2a73d" />
        <rect x="18" y="10" width="4" height="4" fill="#000" />
        <rect x="2" y="17" width="4" height="4" fill="#000" />
        <rect x="6" y="17" width="4" height="4" fill="#eb5829" />
        <rect x="18" y="17" width="4" height="4" fill="#000" />
      </svg>
    );
  }
  return <span className="unknown-vendor" aria-hidden="true" style={{ width: size, height: size }} />;
}
