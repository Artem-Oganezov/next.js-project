const GOOGLE_AD_SCRIPT_SRC = [
  "https://securepubads.g.doubleclick.net",
  "https://pagead2.googlesyndication.com",
  "https://www.googletagservices.com",
  "https://www.google.com",
  "https://adservice.google.com",
];

const GOOGLE_AD_FRAME_SRC = [
  "https://googleads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
  "https://*.safeframe.googlesyndication.com",
  "https://www.google.com",
];

const GOOGLE_AD_IMG_SRC = [
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://www.google.com",
  "https://www.gstatic.com",
];

const GOOGLE_AD_CONNECT_SRC = [
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://securepubads.g.doubleclick.net",
  "https://adservice.google.com",
  "https://www.google.com",
];

function joinSources(base: string[], extra: string[]): string {
  return [...base, ...extra].join(" ");
}

function isGoogleAdsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REVIVE_AD_PROVIDER?.trim().toLowerCase() === "slot";
}

/**
 * Content-Security-Policy for the app shell.
 * When revive ads use Google Ad Manager (`slot`), Google ad domains are allowlisted.
 */
export function buildContentSecurityPolicy(): string {
  const useGoogleAds = isGoogleAdsEnabled();

  const scriptSrc = joinSources(
    ["'self'", "'unsafe-inline'"],
    useGoogleAds ? GOOGLE_AD_SCRIPT_SRC : [],
  );
  const frameSrc = joinSources(["'self'"], useGoogleAds ? GOOGLE_AD_FRAME_SRC : []);
  const imgSrc = joinSources(
    ["'self'", "data:", "blob:"],
    useGoogleAds ? GOOGLE_AD_IMG_SRC : [],
  );
  const connectSrc = joinSources(["'self'"], useGoogleAds ? GOOGLE_AD_CONNECT_SRC : []);
  const styleSrc = "'self' 'unsafe-inline'";

  return (
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; " +
    `img-src ${imgSrc}; script-src ${scriptSrc}; style-src ${styleSrc}; connect-src ${connectSrc}; ` +
    `frame-src ${frameSrc};`
  );
}
