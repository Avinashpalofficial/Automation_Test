// ============================================================
// selector_resolver.ts  (Runner — execution plane)
//
// targetHint (human description)  ->  live Playwright Locator.
//
// IMPORTANT design choices:
//   1. Resolver ek INTERFACE ke peechhe hai. Abhi sirf HeuristicResolver
//      (Option B) hai. AI resolver (Option A) baad mein bas isi interface
//      ka doosra implementation banega — Runner ka koi aur code touch nahi.
//   2. Resolver `Locator` return karta hai, frozen selector STRING nahi.
//      Isse Playwright ka auto-wait + live re-query action-time pe zinda
//      rehta hai. Yahi "disconnected Playwright" bug se bachata hai.
//   3. Resolver kabhi `.fill()` / `.click()` nahi karta. Wo sirf element
//      DHOONDHTA hai. Action chalana dispatcher ka kaam hai.
// ============================================================

import { Page, Locator } from "playwright";
import { StepAction } from "@automation/shared/src";

// ─── Interface seam — yahan se AI fallback plug hoga ──────────
export interface SelectorResolver {
  /**
   * Returns a live Locator for the hint, ya null agar element mile hi nahi.
   * null milne par dispatcher decide karta hai: skip (optional) ya error.
   * Baad mein: ChainedResolver(heuristic -> ai) banega.
   */
  resolve(
    targetHint: string,
    page: Page,
    action: StepAction,
  ): Promise<Locator | null>;
}

// ─── Helpers ─────────────────────────────────────────────────

// Noise words hata ke core keyword nikaalo: "username field" -> "username"
const NOISE =
  /\b(the|a|an|field|input|box|button|link|element|textbox|dropdown|menu|icon)\b/gi;

function toKeyword(hint: string): string {
  return hint.replace(NOISE, "").replace(/\s+/g, " ").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Hint + action se ARIA role guess karo. null = role pata nahi.
function inferRole(hint: string, action: StepAction): string | null {
  const h = hint.toLowerCase();
  if (
    /\bbutton\b|submit|log ?in|sign ?in|sign ?up|register|continue|next/.test(h)
  )
    return "button";
  if (/\blink\b/.test(h)) return "link";
  if (/checkbox/.test(h)) return "checkbox";
  if (/radio/.test(h)) return "radio";
  if (/dropdown|combobox/.test(h) || action === "select") return "combobox";
  if (
    action === "fill" ||
    /\b(field|input|box|email|username|password|name|search)\b/.test(h)
  )
    return "textbox";
  return null;
}

// ─── HeuristicResolver (Option B) ────────────────────────────

export class HeuristicResolver implements SelectorResolver {
  async resolve(
    targetHint: string,
    page: Page,
    action: StepAction,
  ): Promise<Locator | null> {
    const kw = toKeyword(targetHint);
    if (!kw) return null;

    const rx = new RegExp(escapeRegex(kw), "i");
    const role = inferRole(targetHint, action);

    // Priority ladder — sabse precise pehle, generic baad mein.
    const candidates: Locator[] = [];

    // 1. role + accessible name (most precise jab role inferred ho)
    if (role) candidates.push(page.getByRole(role as any, { name: rx }));

    // 2. <label> se juda control (form fields ke liye best)
    candidates.push(page.getByLabel(rx));

    // 3. placeholder text
    candidates.push(page.getByPlaceholder(rx));

    // 4. clickable cheezein — visible text se (button/link)
    if (role === "button" || role === "link")
      candidates.push(page.getByText(rx));

    // 5. data-testid (agar app ne diya ho)
    candidates.push(page.getByTestId(kw.replace(/\s+/g, "-")));

    // Pehla candidate jiska element exist kare, wahi jeeta.
    // .count() ek light query hai — koi action fire nahi hota.
    for (const c of candidates) {
      try {
        if ((await c.count()) > 0) return c.first();
      } catch {
        // ek strategy crash kare to agli try karo
      }
    }

    // Heuristic stuck. null = "yahan baad mein AI fallback lagega".
    return null;
  }
}
