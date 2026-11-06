import { parseRules, type Rule, RULES } from "@/lib/rules";
import { readDoc } from "@/lib/store";
import type { User } from "@/lib/user";

/**
 * The signed-in user's rules: the "rules" document, checked on read, or the seed from
 * src/lib/rules.ts until one is saved. Without a user, or with the store unreachable, the
 * seed, and the error to say so. Server-only.
 */
export function rulesFor(user: User | null): {
  rules: Rule[];
  version: number;
  error: string | null;
} {
  const { doc, error } = user ? readDoc(user.id, "rules") : { doc: null, error: null };
  return doc
    ? { rules: parseRules(doc.payload), version: doc.version, error }
    : { rules: RULES, version: 0, error };
}
