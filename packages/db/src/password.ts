/**
 * Password hashing utility that matches better-auth's password format.
 *
 * better-auth uses `node:crypto` scrypt with this format:
 *   `${saltHex}:${keyHex}`
 * where saltHex is 16 random bytes hex-encoded (32 chars),
 * and keyHex is the 64-byte derived key hex-encoded (128 chars).
 *
 * The hash string is stored in `account.password` and verified
 * during sign-in. If you use any other algorithm (argon2, bcrypt, etc.),
 * verification will always fail.
 *
 * - `hashPassword(password)` → "salt:key"
 * - `verifyPassword(hash, password)` → boolean
 * - `isBetterAuthHash(value)` → true if the string looks like a better-auth hash
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_CONFIG = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
} as const;

function generateKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      SCRYPT_CONFIG.dkLen,
      {
        N: SCRYPT_CONFIG.N,
        r: SCRYPT_CONFIG.r,
        p: SCRYPT_CONFIG.p,
        maxmem: 128 * SCRYPT_CONFIG.N * SCRYPT_CONFIG.r * 2,
      },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;

  const derivedKey = await generateKey(password, salt);
  const storedKey = Buffer.from(key, "hex");

  if (storedKey.length !== derivedKey.length) return false;
  return timingSafeEqual(storedKey, derivedKey);
}

/**
 * Detect whether a string looks like a better-auth `salt:key` hash.
 * Useful when migrating from argon2/bcrypt to better-auth.
 */
export function isBetterAuthHash(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  return (
    /^[0-9a-f]{32}$/i.test(salt!) && /^[0-9a-f]{128}$/i.test(key!)
  );
}
