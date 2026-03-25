export const PRELOADED_DOMAINS = [
    "mail.google.com",
    "outlook.live.com",
    "outlook.office.com",
    "mail.yahoo.com",
    "proton.me",
    "protonmail.com",
    "fastmail.com",
    "youtube.com",
    // "netflix.com",
    "twitch.tv",
    "vimeo.com",
    "notion.so",
    "dropbox.com",
    "onedrive.live.com",
    "box.com",
    "icloud.com",
    "chatgpt.com",
    "gemini.google.com",
    "google.com/search",
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
  "login",
  "account",
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
  "accessibility",
  "settings"
];

function normalizeExclusion(entry) {
  return String(entry || "")
    .replace(/^[*@]*/, "")
    .replace(/^https?:\/\//, "")
    .trim()
    .toLowerCase();
}

async function getExcluded() {
  const r = await chrome.storage.local.get("excluded_domains");
  if (Array.isArray(r.excluded_domains) && r.excluded_domains.length) {
    return r.excluded_domains.map(normalizeExclusion).filter(Boolean);
  }
  return PRELOADED_DOMAINS.map(normalizeExclusion).filter(Boolean);
}

export async function isExcludedUrl(url) {
  try {
    const domains = await getExcluded();
    const { hostname, pathname } = new URL(url);
    const normalizedHostname = hostname.toLowerCase().replace(/^www\./, "");

    const hasExcDomain = domains.some((domain) => {
      const normalizedDomain = domain.replace(/^www\./, "");

      if (normalizedDomain.includes("/")) {
        return `${normalizedHostname}${pathname}`.startsWith(normalizedDomain);
      }

      return normalizedHostname === normalizedDomain;
    });
    
    let path = pathname.toLowerCase();
    const hasExcPath = PATH_EXCLUDE_KEYWORDS.some(keyword => 
      path.includes(keyword)
    );
    return hasExcDomain || hasExcPath;

  } catch (e) {
    return true; // exclude malformed URLs
  }
};
