import { StepAction, TestStep } from "@automation/shared/src";
import { AtomicGoal, ParsedIntent } from "../intent_parser/intent_parser_type";
import { PlanContext, PlanGraphResult } from "./plan_graph.types";

export function buildPlanGraph(intent: ParsedIntent): PlanGraphResult {
  const ctx: PlanContext = {
    userProvidedValues: intent.userProvidedValues || {},
    producedSoFar: new Set<string>(),
    requiredSecrets: new Set<string>(),
    warnings: [],
  };
  collectRiskWarnings(intent, ctx);
  const goalMap = new Map<string, AtomicGoal>();
  for (const g of intent.goals) goalMap.set(g.id, g);
  const steps: TestStep[] = [];

  const orderdId = flattenExcutionOrder(intent, goalMap);
  for (const goalId of orderdId) {
    const goal = goalMap.get(goalId);
    if (!goal) continue;
    const goalSteps = mapGoalToSteps(goal, ctx);
    steps.push(...goalSteps);
    for (const produced of ctx.producedSoFar || []) {
      ctx.producedSoFar.add(produced);
    }
  }
  return {
    steps,
    requiresAuth: intent.requiresAuth || false,
    confidence: intent.confidence ?? 0.5,
    requiredSecrets: [...ctx.requiredSecrets],
    valuesToCapture: intent.valuesToCapture || [],
    warnings: [...ctx.warnings],
    riskFlags: intent.riskFlags || [],
  };

  function mapGoalToSteps(goal: AtomicGoal, ctx: PlanContext): TestStep[] {
    // GoalType typo-safe normalize ("asert" -> "assert")
    const type = normalizeGoalType(goal.type);
    const hint = goal.description;

    switch (type) {
      case "navigate":
        return buildNavigateSteps(goal, hint);

      case "find_element":
        // Standalone find = soft wait. Runner selector resolve karega.
        return [
          step("wait_for_selector", goal, { targetHint: hint, optional: true }),
        ];

      case "interact":
        return buildInteractSteps(goal, ctx, hint);

      case "extract_value":
        return buildExtractSteps(goal, hint);

      case "assert":
        return buildAssertSteps(goal, ctx, hint);

      case "wait_condition":
        return [step("wait_for_selector", goal, { targetHint: hint })];

      case "conditional":
        return buildConditionalSteps(goal, ctx, hint);

      default:
        // Unknown type — safe no-op soft wait
        return [
          step("wait_for_selector", goal, { targetHint: hint, optional: true }),
        ];
    }
  }
  function buildNavigateSteps(goal: AtomicGoal, hint: string): TestStep[] {
    if (isInitialNavigation(goal)) return [];
    /**in app navigation means that ek link/button+click+ agr page change then wait */
    const out: TestStep[] = [step("click", goal, { targetHint: hint })];
    if (goal.expectsNavigation) {
      out.push(step("wait_for_navigation", goal, {}));
    }
    return out;
  }
  function buildInteractSteps(
    goal: AtomicGoal,
    ctx: PlanContext,
    hint: string,
  ): TestStep[] {
    const desc = goal.description.toLowerCase();
    const resolved = resolveValueForGoals(goal, ctx);
    if (resolved.isSecret && resolved.secretKey) {
      ctx.requiredSecrets.add(resolved.secretKey);
    }
    let action: StepAction;
    if (
      /\bfill|type|enter|input\b/.test(desc) &&
      resolved.value !== undefined
    ) {
      action = "fill";
    } else if (/\bselect|choose|pick|dropdown\b/.test(desc)) {
      action = "select";
    } else if (/\bcheck\b/.test(desc) && !/uncheck/.test(desc)) {
      action = "check";
    } else if (/\buncheck\b/.test(desc)) {
      action = "uncheck";
    } else if (
      resolved.value !== undefined &&
      /\bfield|input|box\b/.test(desc)
    ) {
      // value hai + field-jaisa lagta hai -> fill
      action = "fill";
    } else {
      action = "click";
    }
    const out: TestStep[] = [
      step(action, goal, {
        targetHint: hint,
        value: action === "click" ? undefined : resolved.value,
      }),
    ];

    if (goal.expectsNavigation) {
      out.push(step("wait_for_navigation", goal, {}));
    }
    return out;
  }
}
