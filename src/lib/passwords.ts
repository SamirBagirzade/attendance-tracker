import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const keyLength = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, keyLength)) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const storedBuffer = Buffer.from(storedHash, "hex");

  // Always derive at the fixed keyLength: deriving at storedBuffer.length let a
  // truncated or corrupt hash quietly shorten the comparison instead of failing.
  if (storedBuffer.length !== keyLength) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, keyLength)) as Buffer;

  return timingSafeEqual(storedBuffer, derivedKey);
}
