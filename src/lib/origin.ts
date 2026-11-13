/** The site's own address from the request headers (http only for localhost). */
export function originFrom(h: { get(n: string): string | null }): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
}
