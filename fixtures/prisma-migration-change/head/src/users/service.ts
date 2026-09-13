export function displayName(email: string): string {
  return email.split('@')[0] ?? email;
}
