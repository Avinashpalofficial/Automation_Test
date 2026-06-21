// ============================================================
// plan_graph.types.ts
// Output contract of the Manager-side "Test plan graph" stage.
// Intent DAG (ParsedIntent)  ->  normalized, SELECTOR-FREE steps.
//
// Yahan koi DOM/selector nahi aata. Selector resolution Runner ke
// Action Planner (live browser) ka kaam hai. Manager sirf "kya karna
// hai" + "kis cheez pe (human hint)" produce karta hai.
// ============================================================

import { RiskFlag } from "../intent_parser/intent_parser_type";
import { TestStep } from "@automation/shared/src";

/**
 * Plan layer ka final output. `steps` seedha test_cases.steps mein
 * store hote hain aur Runner ko POST /jobs ke through jaate hain.
 */
export interface PlanGraphResult {
  // Normalized steps (selector-free). Runner inhe live DOM pe resolve karega.
  steps: TestStep[];

  // Carry-forward metadata from intent (TestCase build karte waqt useful)
  requiresAuth: boolean;
  confidence: number;

  // Library/secret keys jo Runner ko execution time pe resolve karne honge
  // (password, otp, cvv ...). Plaintext kabhi steps mein nahi jaata.
  requiredSecrets: string[];

  // Values jo execution ke dauraan capture honge (extract_value goals se)
  valuesToCapture: string[];

  // Blocker / high-risk warnings (payment iframe, captcha, destructive ...)
  // Inhe FE pe dikhana chahiye — silently fail mat karna.
  warnings: PlanWarning[];

  // Original risk flags pass-through (TestCase.risk_flags ke liye)
  riskFlags: RiskFlag[];
}

export interface PlanWarning {
  goalId?: string;
  severity: "low" | "medium" | "high" | "blocker";
  message: string;
}

/**
 * Internal resolution context — ek plan build ke dauraan chalta hai.
 * Track karta hai ki ab tak kaunse values produce/capture ho chuke
 * hain, taaki aage ke steps unhe {{var}} se reference kar sakein.
 */
export interface PlanContext {
  userProvidedValues: Record<string, string>;
  producedSoFar: Set<string>; // earlier goals ne jo values produce kiye
  requiredSecrets: Set<string>;
  warnings: PlanWarning[];
}
