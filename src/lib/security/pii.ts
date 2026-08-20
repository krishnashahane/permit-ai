import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// PII (owner name, address) is encrypted at rest with AES-256-GCM. In this demo
// the ciphertext is held in memory; in production these are pgcrypto/KMS-managed
// columns. PII is NEVER sent to analytics and NEVER used to train any model.

function key(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (raw) {
    try {
      const b = Buffer.from(raw, 'base64');
      if (b.length === 32) return b;
    } catch { /* fall through */ }
  }
  // Deterministic dev key so the demo runs without configuration. NOT for prod.
  return scryptSync('permit-ai-dev-key', 'permit-ai-salt', 32);
}

export interface Encrypted {
  iv: string;
  tag: string;
  data: string;
}

export function encryptPII(plaintext: string): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: data.toString('base64') };
}

export function decryptPII(enc: Encrypted): string {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(enc.data, 'base64')), decipher.final()]).toString('utf8');
}

/** Mask for logs / non-privileged roles. "123 Main St" -> "1********t". */
export function maskPII(value: string): string {
  if (!value) return '';
  if (value.length <= 2) return '*'.repeat(value.length);
  return value[0] + '*'.repeat(Math.max(1, value.length - 2)) + value[value.length - 1];
}
