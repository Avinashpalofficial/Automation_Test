//Goal ke liye step value resolve karta hai — 3 sources se:
//   1. SECRET   -> "{{secret.password}}"   (plaintext kabhi nahi)
//   2. CAPTURED -> "{{order_id}}"          (earlier goal ne produce kiya)
//   3. USER     -> literal value           (userProvidedValues se)
//
// Runner in tokens ko execution time pe resolve karta hai:
//   {{secret.X}} -> library/secret vault (audit-logged)
//   {{X}}        -> TestRunContext captured vars

import { AtomicGoal } from "../intent_parser/intent_parser_type";
import { PlanContext } from "./plan_graph.types";
const SECRET_KEYWORDS = [
  "password",
  "api key",
  "token",
  "one time password",
  "passwd",
  "pwd",
  "pin",
  "cvc",
  "cvv",
  "card number",
  "security code",
  "secret",
];
const USER_VALUE_HINTS: Record<string, string[]> = {
  coupon_code: ["coupon", "promo", "discount code", "voucher"],
  quantity: ["quantity", "qty", "how many", "number of"],
  product_name: ["product", "item", "add to cart", "buy", "purchase"],
  email: ["email", "e-mail", "username", "user name", "login id"],
  max_price: ["price", "under", "below", "budget", "max"],
  variant: ["size", "variant", "color", "colour", "option"],
};

export interface ResolvedValue {
  value?: string; // step.value mein jaayega
  isSecret: boolean; // true -> requiredSecrets mein add karo
  secretKey?: string; // e.g. "password"
}
export function resolveValueForGoal(
  goal: AtomicGoal,
  ctx: PlanContext,
): ResolvedValue {
  const desc = goal.description.toLowerCase();

  // ── 1. SECRET detection ──────────────────────────────────
  const secretHit = SECRET_KEYWORDS.find((k) => desc.includes(k));
  if (secretHit) {
    const key = normalizeSecretKey(secretHit);
    return {
      value: `{{secret.${key}}}`,
      isSecret: true,
      secretKey: key,
    };
  }

  // ── 2. CAPTURED value (earlier goal ne produce kiya) ─────
  // requiredContext mein se koi aisi value jo pehle produce ho chuki hai
  const capturedKey = goal.requiredContext.find((k) =>
    ctx.producedSoFar.has(k),
  );
  if (capturedKey) {
    return { value: `{{${capturedKey}}}`, isSecret: false };
  }

  // ── 3. USER-provided literal value ───────────────────────
  for (const [key, hints] of Object.entries(USER_VALUE_HINTS)) {
    if (ctx.userProvidedValues[key] && hints.some((h) => desc.includes(h))) {
      return { value: ctx.userProvidedValues[key], isSecret: false };
    }
  }
  const directKey = goal.requiredContext.find(
    (k) => ctx.userProvidedValues[k] !== undefined,
  );
  if (directKey) {
    return { value: ctx.userProvidedValues[directKey], isSecret: false };
  }

  // Kuch nahi mila — value undefined (e.g. pure click action)
  return { value: undefined, isSecret: false };
}
function normalizeSecretKey(raw: string): string {
  const map: Record<string, string> = {
    passwd: "password",
    pwd: "password",
    "one time password": "otp",
    "card number": "card_number",
    "security code": "cvv",
    cvc: "cvv",
    "api key": "api_key",
  };
  return (map[raw] || raw).replace(/\s+/g, "_");
}
