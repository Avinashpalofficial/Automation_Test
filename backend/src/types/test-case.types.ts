// ============================================================
// test-case.types.ts
// Core data contracts shared between AI planner and runner backend
// ============================================================
import { RiskFlag } from "../module/ai_layer/intent_parser/intent_parser_type";
import { TestStep } from "@automation/shared/src";
// // ─── Action types supported by the Playwright executor ────────
// export type StepAction =
//   | "click"
//   | "fill"
//   | "select"
//   | "hover"
//   | "check"
//   | "uncheck"
//   | "press_key"
//   | "scroll_into_view"
//   | "wait_for_selector"
//   | "wait_for_navigation"
//   | "click_if_exists"
//   | "capture_value"
//   | "assert_text"
//   | "assert_visible"
//   | "assert_url_contains"
//   | "assert_element_count"
//   | "assert_captured_value_equals";

// export interface TestStep {
//   action: StepAction;
//   description: string;

//   // Element targeting — optional because some actions (wait_for_navigation)
//   // don't need a selector
//   selector?: string;

//   // Value used by fill / assert_text / select, etc.
//   // Supports {{variable_name}} interpolation from captured context
//   value?: string;

//   // Used by capture_value — name under which the value is stored
//   variableName?: string;

//   // Execution behavior
//   optional?: boolean; // if true, failure doesn't stop the test
//   retryCount?: number; // default applied by executor if omitted
//   timeoutMs?: number; // default applied by executor if omitted
//   wait_after_ms?: number; // fixed pause after this step executes

//   // Which goal (from intent parsing) this step belongs to —
//   // useful for debugging and for re-planning
//   goalId?: string;
// }

export interface TestCase {
  target_url: string;
  intent: string;
  confidence: number;
  requires_auth: boolean;
  steps: TestStep[];
  values_to_capture: string[];
  user_provided_values: Record<string, string>;
  risk_flags: RiskFlag[];
}
