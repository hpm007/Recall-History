export const EXCLUDED_DOMAINS = [
    // "mail.google.com",
    "outlook.live.com",
    "outlook.office.com",
    "mail.yahoo.com",
    "proton.me",
    "protonmail.com",
    "fastmail.com",
    "youtube.com",
    "netflix.com",
    "primevideo.com",
    "hotstar.com",
    "twitch.tv",
    "vimeo.com",
    // "drive.google.com",
    // "docs.google.com",
    // "sheets.google.com",
    // "slides.google.com",
    "notion.so",
    "dropbox.com",
    "onedrive.live.com",
    "box.com",
    "icloud.com",
    "chatgpt.com",
    "google.com",
    "bing.com",
    "duckduckgo.com",
    "search.yahoo.com",
    "baidu.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com/feed",
    "threads.net",
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "console.aws.amazon.com",
    "cloud.google.com",
    "azure.microsoft.com"
];

const PATH_EXCLUDE_KEYWORDS = [
  "privacy",
  "terms",
  "terms-of-service",
  "terms-and-conditions",
  "cookies",
  "cookie-policy",
  "legal",
  "imprint",
  "gdpr",
  "ccpa",
  "disclaimer",
  "license",
  "copyright",
  "policies",
  "compliance",
  "consent",
  "preferences",
  "security",
  "trust",
  "about",
  "contact",
  "help",
  "support",
  "faq",
  "accessibility",
  "settings"
];

const TITLE_EXCLUDE_KEYWORDS = [
  "privacy policy",
  "cookie policy",
  "terms of service",
  "terms & conditions",
  "legal notice",
  "gdpr",
  "disclaimer",
  "accessibility",
  "about us",
  "contact us",
  "help center",
  "support",
  "faq"
];


export function isExcludedUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);

    const hasExcDomain = EXCLUDED_DOMAINS.some(domain =>
      hostname.includes(domain)
      // (domain.includes("/") && `${hostname}${pathname}`.startsWith(domain))
    );
    let path = pathname.toLowerCase();
    
    const hasExcPath = PATH_EXCLUDE_KEYWORDS.some(keyword => 
      path.includes(keyword)
    );
    return hasExcDomain || hasExcPath;

  } catch {
    return true; // exclude malformed URLs
  }
};
