import { StepAction, TestStep } from "@automation/shared/src";
import {
  AtomicGoal,
  GoalType,
  ParsedIntent,
} from "../intent_parser/intent_parser_type";
import { PlanContext, PlanWarning } from "./plan_graph.types";

/**................................. */
export function step(
  action: StepAction,
  goal: AtomicGoal,
  extra: Partial<TestStep>,
): TestStep {
  return {
    action,
    description: goal.description,
    goalId: goal.id,
    ...extra,
  };
}

// ── helper: description se quoted value nikalo ──────────────
// "... with 'student'"  ->  student
// '... with "Password123"' -> Password123
export function quotedLiteral(desc: string): string | undefined {
  // Pehle "with/to/as/=" ke baad wali quoted value (asli typed value)
  const afterKw = desc.match(/\b(?:with|to|as|=)\s*['"]([^'"]+)['"]/i);
  if (afterKw) return afterKw[1];
  // Warna last quoted segment (field-name vs value confusion se bachne ke liye)
  const all = [...desc.matchAll(/['"]([^'"]+)['"]/g)];
  return all.length ? all[all.length - 1][1] : undefined;
}
export function isInitialNavigation(goal: AtomicGoal): boolean {
  const desc = goal.description.toLowerCase();
  const looksLikeUrlNav =
    /\b(go to|open|visit|navigate to|load)\b/.test(desc) &&
    /\b(url|page|site|website|homepage|home page)\b/.test(desc);
  return looksLikeUrlNav && (goal.dependsOn?.length ?? 0) === 0;
}
export function normalizeGoalType(t: GoalType | string): string {
  const fixes: Record<string, string> = {
    asert: "assert", // intent_parser_type.ts ka typo
    assertion: "assert",
  };
  return fixes[t as string] || (t as string);
}

export function flattenExcutionOrder(
  intent: ParsedIntent,
  goalMap: Map<string, AtomicGoal>,
): string[] {
  if (intent.executionOrder && intent.executionOrder.length > 0) {
    return intent.executionOrder.flat();
  }
  return intent.goals.map((g) => g.id);
}

export function collectRiskWarnings(
  intent: ParsedIntent,
  ctx: PlanContext,
): void {
  for (const flag of intent.riskFlags) {
    if (flag.severity == "blocker" || flag.severity == "high") {
      const warn: PlanWarning = {
        severity: flag.severity,
        message: `[${flag.type}] ${flag.description}`,
      };
      ctx.warnings.push(warn);
    }
  }
}
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
