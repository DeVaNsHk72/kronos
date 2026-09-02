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

/** The stored role, or null when this browser has not answered yet. */
export function getRole(): Role | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "student" || v === "teacher" ? v : null;
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null. An unanswerable read is the same as an unanswered one:
    // the gate shows again, which is the safe direction to fail.
    return null;
  }
}

export function setRole(role: Role) {
  try {
    localStorage.setItem(KEY, role);
  } catch {
    // The choice still routes this session; it just will not survive a reload.
  }
}

export function clearRole() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
