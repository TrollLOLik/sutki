export type ContactChannel = 'phone' | 'email';

export function getTrustedContact(profile: { phone: string; email: string }): { channel: ContactChannel; value: string } | null {
  const phone = profile.phone.trim();
  if (phone) return { channel: 'phone', value: phone };
  const email = profile.email.trim().toLowerCase();
  return email ? { channel: 'email', value: email } : null;
}

export function contactCodeLength(channel: ContactChannel): 4 | 6 {
  return channel === 'phone' ? 4 : 6;
}

export function maskContact(channel: ContactChannel, value: string): string {
  if (channel === 'phone') {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 4 ? `+7 ••• •••-${digits.slice(-4, -2)}-${digits.slice(-2)}` : value;
  }
  const [name, domain = ''] = value.split('@');
  if (name.length <= 2) return `${name[0] ?? ''}***@${domain}`;
  return `${name[0]}${'*'.repeat(Math.min(6, Math.max(3, name.length - 2)))}${name.at(-1)}@${domain}`;
}
