// File-type / size validation + a mock virus scan gate. Real deployments would
// wire the scan to ClamAV / a cloud AV API before any parsing happens.

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg']);

// Magic-number sniffing — never trust the client-declared MIME type alone.
const SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
];

// Signatures known to be executable / dangerous — reject outright.
const DANGEROUS: { name: string; bytes: number[] }[] = [
  { name: 'ELF', bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: 'PE/EXE', bytes: [0x4d, 0x5a] },
  { name: 'Mach-O', bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: 'ZIP/Office-macro', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { name: 'Shell script', bytes: [0x23, 0x21] }, // #!
];

export interface ValidationResult {
  ok: boolean;
  detectedMime?: string;
  reason?: string;
}

function startsWith(buf: Uint8Array, sig: number[]) {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

export function validateUpload(
  declaredMime: string,
  bytes: Uint8Array,
): ValidationResult {
  if (bytes.length === 0) return { ok: false, reason: 'Empty file.' };
  if (bytes.length > MAX_FILE_BYTES)
    return { ok: false, reason: `File exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB limit.` };

  for (const d of DANGEROUS) {
    if (startsWith(bytes, d.bytes))
      return { ok: false, reason: `Blocked: file looks like a ${d.name} executable/archive, not a plan.` };
  }

  const match = SIGNATURES.find((s) => startsWith(bytes, s.bytes));
  if (!match) return { ok: false, reason: 'Unrecognized file. Only PDF, PNG, or JPEG plan sheets are accepted.' };
  if (!ALLOWED.has(match.mime)) return { ok: false, reason: 'File type not allowed.' };
  if (declaredMime && ALLOWED.has(declaredMime) && declaredMime !== match.mime) {
    return { ok: false, reason: 'Declared file type does not match file contents.' };
  }
  return { ok: true, detectedMime: match.mime };
}

/**
 * Mock virus scan. Returns a promise so the call site awaits it exactly as it
 * would a real AV service. Flags the classic EICAR test string.
 */
export async function scanForMalware(bytes: Uint8Array): Promise<ValidationResult> {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
  if (head.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
    return { ok: false, reason: 'Malware signature detected (EICAR). Upload rejected.' };
  }
  return { ok: true };
}
