/**
 * Password policy for SecureWatch360.
 *
 * Requirements (enforced both client- and server-side where applicable):
 *   • Minimum 16 characters
 *   • At least one uppercase letter (A-Z)
 *   • At least one lowercase letter (a-z)
 *   • At least one digit (0-9)
 *   • At least one special character (any non-alphanumeric)
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 16 characters",
    test: (p) => p.length >= 16,
  },
  {
    id: "uppercase",
    label: "One uppercase letter (A–Z)",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "lowercase",
    label: "One lowercase letter (a–z)",
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: "digit",
    label: "One number (0–9)",
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: "special",
    label: "One special character (!@#$…)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

/**
 * Returns null when the password meets all requirements, or a human-readable
 * error message describing the first failing rule.
 */
export function validatePassword(password: string): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      return rule.label + " is required.";
    }
  }
  return null;
}
