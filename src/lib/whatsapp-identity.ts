export interface MessageAddress {
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
}

export function jidDigits(jid?: string | null): string {
  return jid?.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? "";
}

export function normalizePhoneDigits(phone?: string | null): string {
  return phone?.replace(/\D/g, "") ?? "";
}

export function phoneNumbersMatch(
  left?: string | null,
  right?: string | null,
): boolean {
  const leftDigits = normalizePhoneDigits(left);
  const rightDigits = normalizePhoneDigits(right);
  if (!leftDigits || !rightDigits) return false;
  return (
    leftDigits === rightDigits ||
    leftDigits.slice(-10) === rightDigits.slice(-10)
  );
}

export function isAuthorizedAddress(
  address: MessageAddress,
  authorizedPhone?: string | null,
): boolean {
  const expected = normalizePhoneDigits(authorizedPhone);
  if (!expected) return false;
  return [address.remoteJid, address.remoteJidAlt].some((jid) =>
    phoneNumbersMatch(jidDigits(jid), expected),
  );
}

export function preferredPhoneJid(address: MessageAddress): string | null {
  const candidates = [address.remoteJid, address.remoteJidAlt].filter(
    (jid): jid is string => !!jid,
  );
  return (
    candidates.find((jid) => jid.endsWith("@s.whatsapp.net")) ??
    candidates[0] ??
    null
  );
}

export function alternateJid(address: MessageAddress): string | null {
  return address.remoteJidAlt && address.remoteJidAlt !== address.remoteJid
    ? address.remoteJidAlt
    : null;
}

export function exportablePhone(jid: string, alternate?: string | null): string {
  const phoneJid = [jid, alternate].find((item) =>
    item?.endsWith("@s.whatsapp.net"),
  );
  const digits = jidDigits(phoneJid);
  return digits ? `+${digits}` : "";
}
