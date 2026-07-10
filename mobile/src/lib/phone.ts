/** Strip everything but digits; if number starts with 7/8 and is 11 digits, drop the prefix. */
export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if ((digits.startsWith('7') || digits.startsWith('8')) && digits.length === 11) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** Format up to 10 digits as (XXX) XXX-XX-XX */
export function formatPhoneMask(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  
  let result = '(' + d.slice(0, Math.min(d.length, 3));
  if (d.length > 3) {
    result += ') ' + d.slice(3, Math.min(d.length, 6));
  }
  if (d.length > 6) {
    result += '-' + d.slice(6, Math.min(d.length, 8));
  }
  if (d.length > 8) {
    result += '-' + d.slice(8, 10);
  }
  return result;
}

/** Extract raw 10 digits from masked value, then build +7XXXXXXXXXX for the API. */
export function toFullPhone(masked: string): string {
  const digits = masked.replace(/\D/g, '').slice(0, 10);
  return '+7' + digits;
}
