import OpenAI from "openai";
import { IntentParser } from "../intent_parser/intent_parser.service";
import { AtomicGoal, ParsedIntent } from "../intent_parser/intent_parser_type";
import { TestCase } from "../../../types/test-case.types";
import { TestStep, StepAction } from "@automation/shared";
import {
  compressDOMForAI,
  CompressedDOM,
} from "../dom_compressor/dom_compressor";
import { SPAPageData } from "../page_analyzer/spa-page-analyzer.service";

// ─── Zod-less runtime shape check for AI output ────────────────
// (Use your existing Zod TestCaseSchema here instead if preferred —
//  this keeps the file self-contained.)
function isValidStepArray(value: unknown): value is TestStep[] {
  return (
    Array.isArray(value) &&
    value.every((s) => typeof s === "object" && s !== null && "action" in s)
  );
}

const VALID_ACTIONS: StepAction[] = [
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
];

export class AITestPlanner {
  private nvidiaClient: OpenAI;
  private fallBackModels: Array<{
    provider: "nvidia";
    model: string;
    client: any;
  }>;
  constructor() {
    this.nvidiaClient = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: "https://integrate.api.nvidia.com/v1",
    });
    this.fallBackModels = [
      {
        provider: "nvidia",
        model: "meta/llama-3.3-70b-instruct",
        client: this.nvidiaClient,
      },
      {
        provider: "nvidia",
        model: "nvidia/nemotron-3-super-120b-a12b",
        client: this.nvidiaClient,
      },
      {
        provider: "nvidia",
        model: "meta/llama-3.1-8b-instruct",
        client: this.nvidiaClient,
      },
      {
        provider: "nvidia",
        model: "nemotron-3-ultra-550b-a55b",
        client: this.nvidiaClient,
      },
    ];
  }
  // ─── Entry point ───────────────────────────────────────────

  async generateTestCase(
    prompt: string,
    pageData: SPAPageData,
  ): Promise<TestCase> {
    const parser = new IntentParser();
    const intent = await parser.parse(prompt, pageData.url);
    console.log("parser:", intent);

    const blockers = intent.riskFlags.filter((r) => r.severity === "blocker");
    if (blockers.length > 0) {
      console.warn("⚠️ Blockers detected:", blockers);
      // We warn but still attempt — the executor will surface a clear
      // failure (e.g. cross-origin iframe) rather than silently refusing.
    }

    if (intent.overallComplexity === "simple") {
      return this.generateSimpleTestCase(intent, pageData);
    }

    return this.generateComplexTestCase(intent, pageData);
  }

  // ─── Simple path — single AI call, no goal decomposition ────

  private async generateSimpleTestCase(
    intent: ParsedIntent,
    pageData: SPAPageData,
  ): Promise<TestCase> {
    const compressed = compressDOMForAI(pageData);

    const systemPrompt = `
You are an expert QA automation engineer. Generate a short Playwright test
step sequence as a JSON array. Each step must match this shape:

{
  "action": one of ${JSON.stringify(VALID_ACTIONS)},
  "description": "human readable description",
  "selector": "CSS selector, only from the provided element list",
  "value": "optional value for fill/assert/select",
  "variableName": "optional, only for capture_value",
  "optional": false
}

STRICT RULES:
- Only use selectors that appear in AVAILABLE ELEMENTS below.
- Return ONLY a raw JSON array. No markdown, no prose, no code fences.
`;

    const userPrompt = `
USER GOAL: ${intent.originalPrompt}

AVAILABLE ELEMENTS:
${JSON.stringify(compressed, null, 2)}

USER PROVIDED VALUES:
${JSON.stringify(intent.userProvidedValues, null, 2)}
`;

    const steps = await this.callModelForSteps(systemPrompt, userPrompt);

    return {
      target_url: pageData.url,
      intent: intent.summary || intent.originalPrompt,
      confidence: intent.confidence,
      requires_auth: intent.requiresAuth,
      steps,
      values_to_capture: intent.valuesToCapture,
      user_provided_values: intent.userProvidedValues,
      risk_flags: intent.riskFlags,
    };
  }

  // ─── Complex path — goal-by-goal generation ──────────────────

  private async generateComplexTestCase(
    intent: ParsedIntent,
    pageData: SPAPageData,
  ): Promise<TestCase> {
    const allSteps: TestStep[] = [];

    for (const batch of intent.executionOrder) {
      for (const goalId of batch) {
        const goal = intent.goals.find((g) => g.id === goalId);
        if (!goal) {
          console.warn(`Goal "${goalId}" not found in intent.goals — skipping`);
          continue;
        }

        const goalSteps = await this.generateStepsForGoal(
          goal,
          intent,
          pageData,
        );
        allSteps.push(...goalSteps);

        if (goal.expectsNavigation) {
          allSteps.push({
            action: "wait_for_navigation",
            description: `Wait for page transition after: ${goal.description}`,
            wait_after_ms: 2000,
            goalId: goal.id,
          });
        }
      }
    }

    return {
      target_url: pageData.url,
      intent: intent.summary,
      confidence: intent.confidence,
      requires_auth: intent.requiresAuth,
      steps: allSteps,
      values_to_capture: intent.valuesToCapture,
      user_provided_values: intent.userProvidedValues,
      risk_flags: intent.riskFlags,
    };
  }

  // ─── Per-goal step generation — the actual AI call lives here ─

  private async generateStepsForGoal(
    goal: AtomicGoal,
    intent: ParsedIntent,
    pageData: SPAPageData,
  ): Promise<TestStep[]> {
    const compressed = compressDOMForAI(pageData);

    const systemPrompt = `
You are an expert QA automation engineer generating steps for ONE goal
within a larger test plan. Return ONLY a raw JSON array of steps, no
markdown, no prose, no code fences.

Each step must match this shape:
{
  "action": one of ${JSON.stringify(VALID_ACTIONS)},
  "description": "human readable description",
  "selector": "CSS selector, only from AVAILABLE DOM ELEMENTS",
  "value": "optional — use {{variable_name}} to reference captured values",
  "variableName": "required only for capture_value steps",
  "optional": false
}

STRICT RULES:
- Only use selectors present in AVAILABLE DOM ELEMENTS.
- If this goal must produce values listed in "VALUES THIS GOAL MUST CAPTURE",
  include a capture_value step with a matching variableName for each one.
- Do not invent selectors. If nothing fits, omit the step rather than guess.
`;

    const userPrompt = `
GOAL: ${goal.description}
GOAL TYPE: ${goal.type}

AVAILABLE DOM ELEMENTS:
${JSON.stringify(compressed, null, 2)}

VALUES AVAILABLE FROM PREVIOUS STEPS:
${JSON.stringify(intent.userProvidedValues, null, 2)}

VALUES THIS GOAL MUST CAPTURE:
${JSON.stringify(goal.produceContext, null, 2)}

POSSIBLE FAILURES TO HANDLE:
${JSON.stringify(goal.possibleFailure, null, 2)}

Generate ONLY the steps needed for this specific goal.
`;

    const steps = await this.callModelForSteps(
      systemPrompt,
      userPrompt,
      goal.id,
    );
    return steps;
  }
  private async generateWithFallback(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const prompt = `${systemPrompt}\n\n${userPrompt}`;

    let lastError: any;

    for (const modelConfig of this.fallBackModels) {
      console.log("BEFORE AI CALL");

      try {
        console.log(
          `🚀 Trying ${modelConfig.provider} -> ${modelConfig.model}`,
        );
        console.time("AI_CALL");
        const response = await modelConfig.client.chat.completions.create(
          {
            model: modelConfig.model,
            temperature: 0,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
          },
          {
            timeout: 60_000,
          },
        );
        console.timeEnd("AI_CALL");
        console.log("after AI CALL");
        const text = response.choices[0]?.message?.content?.trim();

        if (!text) {
          throw new Error("Empty response");
        }

        console.log(`✅ Success: ${modelConfig.model}`);

        return text;
      } catch (err: any) {
        lastError = err;

        console.warn(
          `❌ ${modelConfig.provider} (${modelConfig.model}) failed:`,
          err.message,
        );
      }
    }

    throw new Error(
      `All fallback models failed.\nLast Error: ${lastError?.message}`,
    );
  }
  // ─── Shared AI call + parsing + validation ───────────────────

  private async callModelForSteps(
    systemPrompt: string,
    userPrompt: string,
    goalId?: string,
  ): Promise<TestStep[]> {
    const raw = await this.generateWithFallback(systemPrompt, userPrompt);

    const cleaned = this.stripCodeFences(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse AI step output:", cleaned);
      return [];
    }

    if (!isValidStepArray(parsed)) {
      console.error("AI output did not match TestStep[] shape:", parsed);
      return [];
    }

    // Tag each step with its originating goal for debugging / re-planning
    return parsed.map((step) => ({
      ...step,
      goalId: step.goalId ?? goalId,
    }));
  }

  private stripCodeFences(text: string): string {
    return text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
}
