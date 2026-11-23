import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Passwords are encrypted with AES-256-GCM using VAULT_KEY from the server
 * environment. The key never reaches the browser or the database. Losing or
 * changing VAULT_KEY makes stored passwords unreadable, so back it up with
 * the database. */
function vaultKey(): Buffer | null {
  const raw = process.env.VAULT_KEY?.trim();
  if (!raw || raw.length < 16) return null;
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32 && /^[A-Za-z0-9+/=]+$/.test(raw)) return decoded;
  return createHash("sha256").update(raw, "utf8").digest();
}

export function vaultReady() {
  return vaultKey() !== null;
}

export function encryptSecret(plain: string): string {
  const key = vaultKey();
  if (!key)
    throw new Error(
      "The password vault is not set up. Ask your administrator to set VAULT_KEY.",
    );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const key = vaultKey();
  if (!key) throw new Error("The password vault is not set up (VAULT_KEY).");
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || data === undefined)
    throw new Error("Stored password has an unknown format");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("This password cannot be decrypted. VAULT_KEY may have changed.");
  }
}
