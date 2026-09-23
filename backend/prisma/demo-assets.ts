// Deterministic seed-only artwork. Data URIs keep demo data independent from
// mutable third-party placeholder services while remaining browser-readable.
export function demoImage(label: string): string {
  const safeLabel = label.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#EAF3FF"/><rect x="72" y="72" width="1056" height="756" rx="56" fill="#FFFFFF" stroke="#C8E0FA" stroke-width="8"/><circle cx="600" cy="350" r="110" fill="#DDEEFF"/><path d="M550 405h100v-110H550z" fill="#1167D8" opacity=".85"/><text x="600" y="575" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="700" fill="#0C4FA8">${safeLabel}</text><text x="600" y="650" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#4A6072">Demo BMarket</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const demoImageJson = (label: string) => JSON.stringify([demoImage(label)]);
