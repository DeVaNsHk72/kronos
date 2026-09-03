/**
 * Who is holding the sheet.
 *
 * A student ranking topics under exam pressure and a lecturer assembling a
 * paper they must defend want opposite things from identical rows, so the
 * question is asked once, before anything is shown, and then remembered. It is
 * a routing preference, not an identity: nothing is gated on it and it can be
 * changed from the welcome sheet at any time.
 */

export type Role = "student" | "teacher";

const KEY = "kronos-role";

export const HOME: Record<Role, string> = {
  student: "/ask",
  teacher: "/faculty",
};

// Private windows and blocked site data throw on localStorage access rather
// than returning null. Wrap once; every caller gets the safe direction.
function safeLS(fn: () => void): void {
  try { fn(); } catch { /* ignore */ }
}

/** The stored role, or null when this browser has not answered yet. */
export function getRole(): Role | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "student" || v === "teacher" ? v : null;
  } catch {
    return null;
  }
}

export function setRole(role: Role) {
  safeLS(() => localStorage.setItem(KEY, role));
}

export function clearRole() {
  safeLS(() => localStorage.removeItem(KEY));
}
