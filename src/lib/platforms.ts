// Platform detection and brand config

export interface Platform {
  name: string;
  color: string;
  domains: string[];
}

export const PLATFORMS: Platform[] = [
  { name: 'YouTube',    color: '#FF0000', domains: ['youtube.com', 'youtu.be'] },
  { name: 'TikTok',    color: '#00F2EA', domains: ['tiktok.com'] },
  { name: 'Instagram', color: '#E1306C', domains: ['instagram.com'] },
  { name: 'Twitter/X', color: '#1DA1F2', domains: ['twitter.com', 'x.com'] },
  { name: 'Facebook',  color: '#1877F2', domains: ['facebook.com', 'fb.watch'] },
  { name: 'Reddit',    color: '#FF4500', domains: ['reddit.com', 'v.redd.it'] },
  { name: 'Twitch',    color: '#9146FF', domains: ['twitch.tv'] },
  { name: 'Vimeo',     color: '#1AB7EA', domains: ['vimeo.com'] },
];

export function detectPlatform(url: string): Platform | null {
  const lower = url.toLowerCase();
  return PLATFORMS.find(p => p.domains.some(d => lower.includes(d))) ?? null;
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSupportedUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  const lower = url.toLowerCase();
  return PLATFORMS.some(p => p.domains.some(d => lower.includes(d)));
}
