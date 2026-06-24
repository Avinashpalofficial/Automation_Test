// ============================================================
// action_dispatcher.ts  (Runner — execution plane)
//
// Ek TestStep ko live page pe RUN karta hai:
//   resolve element (resolver)  ->  interpolate value  ->  action.
//
// DISTINCT ERROR TYPES — ye tumhare architecture ke liye important hai:
//   - ResolutionError : element MILA HI NAHI. Heuristic stuck. Yahi wo
//                       signal hai jispe baad mein AI self-heal / AI
//                       resolver fire hoga.
//   - StepAssertionError : assertion FAIL hui. Ye execution failure NAHI
//                       hai — ho sakta hai ye ek legit negative-test ka
//                       expected outcome ho. Isliye ALAG type, taaki
//                       upar wali run-engine self-heal NA chalaye.
//   Baaki Playwright errors (timeout etc.) as-is bubble karte hain.
// ============================================================

import { Page, Locator } from "playwright";
import { TestStep } from "@automation/shared/src";
import { SelectorResolver } from "../execution/selector_resolver";

// ─── Error types ─────────────────────────────────────────────
export class ResolutionError extends Error {
  constructor(public hint: string) {
    super(`Could not resolve element for hint: "${hint}"`);
    this.name = "ResolutionError";
  }
}

export class StepAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepAssertionError";
  }
}

// ─── Execution context (run ke dauraan jeeta hai) ────────────
export interface DispatchContext {
  captured: Record<string, string>; // {{var}}        — capture_value se bharta
  secrets: Record<string, string>; // {{secret.x}}   — library resolution se
}

export type DispatchResult =
  | { status: "done" }
  | { status: "skipped"; reason: string };

// ─── {{var}} / {{secret.x}} interpolation ────────────────────
function interpolate(raw: string, ctx: DispatchContext): string {
  return raw.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    if (key.startsWith("secret.")) return ctx.secrets[key.slice(7)] ?? "";
    return ctx.captured[key] ?? "";
  });
}

// Kaunse actions ko DOM element (locator) chahiye
const NEEDS_LOCATOR = new Set<TestStep["action"]>([
  "click",
  "fill",
  "select",
  "hover",
  "check",
  "uncheck",
  "scroll_into_view",
  "click_if_exists",
  "wait_for_selector",
  "capture_value",
  "assert_text",
  "assert_visible",
  "assert_element_count",
]);

// ─── Main dispatch ───────────────────────────────────────────
export async function dispatchStep(
  step: TestStep,
  page: Page,
  resolver: SelectorResolver,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  const value =
    step.value !== undefined ? interpolate(step.value, ctx) : undefined;

  // ── Page-level / context-only actions (koi locator nahi) ──
  switch (step.action) {
    case "wait_for_navigation":
      await page.waitForLoadState("networkidle");
      return { status: "done" };

    case "assert_url_contains": {
      const ok = page.url().includes(value ?? "");
      if (!ok)
        throw new StepAssertionError(
          `URL "${page.url()}" does not contain "${value}"`,
        );
      return { status: "done" };
    }

    case "assert_captured_value_equals": {
      const actual = ctx.captured[step.variableName ?? ""] ?? "";
      if (actual !== (value ?? ""))
        throw new StepAssertionError(
          `Captured "${step.variableName}" = "${actual}", expected "${value}"`,
        );
      return { status: "done" };
    }

    case "press_key":
      // targetHint na ho to page-level key press
      if (!step.targetHint) {
        await page.keyboard.press(value ?? "Enter");
        return { status: "done" };
      }
      break; // warna neeche resolve hoga
  }

  // ── Locator-needing actions ──
  if (!NEEDS_LOCATOR.has(step.action) && step.action !== "press_key") {
    // koi unknown / unhandled action
    return { status: "skipped", reason: `unhandled action: ${step.action}` };
  }

  if (!step.targetHint) {
    if (step.optional)
      return { status: "skipped", reason: "no targetHint, optional" };
    throw new ResolutionError("<missing targetHint>");
  }

  const loc = await resolver.resolve(step.targetHint, page, step.action);

  // YE wo jagah hai jahan `null.fill()` crash hota tha.
  // Ab clean: ya skip (optional/click_if_exists) ya typed error.
  if (!loc) {
    if (step.optional || step.action === "click_if_exists")
      return { status: "skipped", reason: "element not found (optional)" };
    throw new ResolutionError(step.targetHint);
  }

  const timeout = step.timeoutMs;

  switch (step.action) {
    case "fill":
      await loc.fill(value ?? "", { timeout });
      break;
    case "click":
    case "click_if_exists":
      await loc.click({ timeout });
      break;
    case "select":
      await loc.selectOption(value ?? "", { timeout });
      break;
    case "hover":
      await loc.hover({ timeout });
      break;
    case "check":
      await loc.check({ timeout });
      break;
    case "uncheck":
      await loc.uncheck({ timeout });
      break;
    case "press_key":
      await loc.press(value ?? "Enter", { timeout });
      break;
    case "scroll_into_view":
      await loc.scrollIntoViewIfNeeded({ timeout });
      break;
    case "wait_for_selector":
      await loc.waitFor({ state: "visible", timeout });
      break;

    case "capture_value": {
      // input ho to inputValue, warna textContent
      const v =
        (await loc.inputValue().catch(() => null)) ??
        (await loc.textContent()) ??
        "";
      if (step.variableName) ctx.captured[step.variableName] = v.trim();
      break;
    }

    // ── Assertions (fail = StepAssertionError, NOT a resolve failure) ──
    case "assert_visible": {
      if (!(await loc.isVisible()))
        throw new StepAssertionError(`Not visible: "${step.targetHint}"`);
      break;
    }
    case "assert_text": {
      const text = (await loc.textContent()) ?? "";
      if (!text.includes(value ?? ""))
        throw new StepAssertionError(
          `Text "${text.trim()}" does not contain "${value}"`,
        );
      break;
    }
    case "assert_element_count": {
      const n = await loc.count();
      if (n !== Number(value))
        throw new StepAssertionError(`Element count ${n}, expected ${value}`);
      break;
    }
  }

  if (step.wait_after_ms) await page.waitForTimeout(step.wait_after_ms);
  return { status: "done" };
}
