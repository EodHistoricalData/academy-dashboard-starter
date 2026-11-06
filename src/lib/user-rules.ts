import { parseRules, type Rule, RULES } from "@/lib/rules";
import { getDoc } from "@/lib/store";
import type { User } from "@/lib/user";

/**
 * The signed-in user's rules: the "rules" document, checked on read, or the seed from
 * src/lib/rules.ts until one is saved. Without a user, the seed. Server-only.
 */
export function rulesFor(user: User | null): { rules: Rule[]; version: number } {
  const doc = user ? getDoc(user.id, "rules") : null;
  return doc ? { rules: parseRules(doc.payload), version: doc.version } : { rules: RULES, version: 0 };
}
