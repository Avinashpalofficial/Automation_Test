// ============================================================
// step-schema.ts
// SINGLE SOURCE OF TRUTH — Manager + Runner dono ka step contract.
// Zod schema se hi TypeScript type infer hota hai, taaki ek hi
// definition se compile-time type AUR runtime validation dono milein.
//
// Manager: steps produce karke StepsSchema.parse() se validate karta hai.
// Runner : POST /jobs pe incoming steps ko StepsSchema.parse() se gate karta hai.
// ============================================================

import { z } from "zod";

// ─── Action types supported by the Playwright executor ────────
export const StepActionSchema = z.enum([
  "click",
  "fill",
  "select",
  "hover",
  "check",
  "uncheck",
  "press_key",
  "scroll_into_view",
  "wait_for_selector",
  "wait_for_navigation",
  "click_if_exists",
  "capture_value",
  "assert_text",
  "assert_visible",
  "assert_url_contains",
  "assert_element_count",
  "assert_captured_value_equals",
]);

export type StepAction = z.infer<typeof StepActionSchema>;

// ─── Ek single step ka wire contract ─────────────────────────
export const StepSchema = z.object({
  action: StepActionSchema,
  description: z.string(),

  // Manager khaali chhodta hai; Runner live DOM pe resolve karke fill karta hai
  selector: z.string().optional(),

  // Manager bhejta hai (human hint, e.g. "login button"); Runner isse selector resolve karta hai
  targetHint: z.string().optional(),

  // fill / select / assert_text ke liye. {{var}} aur {{secret.x}} interpolation support
  value: z.string().optional(),

  // capture_value ke liye — kis naam se value store hogi
  variableName: z.string().optional(),

  // Execution behavior
  optional: z.boolean().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  timeoutMs: z.number().int().positive().optional(),
  wait_after_ms: z.number().int().nonnegative().optional(),

  // Debugging / re-planning ke liye — kis goal se aaya
  goalId: z.string().optional(),
});

export type TestStep = z.infer<typeof StepSchema>;

// ─── Steps array (POST /jobs payload.steps) ──────────────────
export const StepsSchema = z.array(StepSchema);
export type TestSteps = z.infer<typeof StepsSchema>;
