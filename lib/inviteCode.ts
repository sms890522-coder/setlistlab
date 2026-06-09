const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 5;

export function generateInviteCode(prefix = "SL") {
  const values = new Uint32Array(INVITE_CODE_LENGTH);

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    }
  }

  const code = Array.from(values, (value) => INVITE_CODE_ALPHABET[value % INVITE_CODE_ALPHABET.length]).join("");
  return `${prefix}-${code}`;
}

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
