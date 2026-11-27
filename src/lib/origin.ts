import { headers } from "next/headers";

function isLoopback(host: string) {
  const name = host.replace(/:\d+$/, "").toLowerCase();
  return name === "localhost" || name.startsWith("127.") || name === "[::1]";
}

/** A bare host[:port] as browsers send it, with nothing that could change the URL. */
function safeHost(host: string) {
  if (!host || host.length > 255 || /[/?#@\s\\]/.test(host)) return false;
  try {
    return new URL(`http://${host}`).host === host.toLowerCase();
  } catch {
    return false;
  }
}

/** Origin for links people copy and send to teammates. A configured public
 * URL wins; a missing or localhost URL falls back to the address the person
 * is using right now, so links copied on an office IP work for colleagues. */
export async function shareOrigin() {
  const configured = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
  let configuredHost = "";
  try {
    configuredHost = configured ? new URL(configured).host : "";
  } catch {
    configuredHost = "";
  }
  if (configuredHost && !isLoopback(configuredHost)) return configured;
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim() === "https" ? "https" : "http";
  if (safeHost(host)) return `${proto}://${host.toLowerCase()}`;
  return configured || "http://localhost:3000";
}
