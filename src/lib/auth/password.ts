import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hashing password basato su scrypt (node:crypto), senza dipendenze esterne.
 * Formato: `scrypt$N$r$p$<salt base64>$<hash base64>`.
 * I parametri sono salvati nell'hash per poterli aumentare in futuro
 * senza invalidare gli hash esistenti.
 */

const KEY_LENGTH = 64;
const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, DEFAULT_PARAMS);
  const { N, r, p } = DEFAULT_PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, n, r, p, saltB64, hashB64] = storedHash.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltB64 || !hashB64) {
    return false;
  }

  const expected = Buffer.from(hashB64, "base64");
  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  try {
    const actual = await deriveKey(password, Buffer.from(saltB64, "base64"), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
