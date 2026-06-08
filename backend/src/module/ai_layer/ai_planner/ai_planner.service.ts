import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// ============= Type Definitions =============

// Zod Schema for validation
const ActionSchema = z.enum([
  "click",
  "fill",
  "select",
  "hover",
  "wait",
  "scroll",
  "press",
  "navigate",
  "assert_exists",
  "assert_visible",
  "assert_text",
  "assert_value",
]);

// Base Step Schema
const BaseStepSchema = z.object({
  action: ActionSchema,
  selector: z.string().optional(),
  value: z.string().optional(),
  wait_after_ms: z.number().min(0).max(30000).optional().default(500),
  retry_count: z.number().min(0).max(5).optional().default(1),
  description: z.string().optional(),
  optional: z.boolean().optional().default(false),
});

// Refined Step Schema with validation
const StepSchema = BaseStepSchema.refine(
  (data) => {
    const needsSelector = [
      "click",
      "fill",
      "select",
      "hover",
      "scroll",
      "assert_exists",
      "assert_visible",
      "assert_text",
      "assert_value",
    ];

    if (needsSelector.includes(data.action)) {
      return data.selector !== undefined && data.selector.trim().length > 0;
    }
    return true;
  },
  { message: "Selector is required for this action", path: ["selector"] },
).refine(
  (data) => {
    const needsValue = [
      "fill",
      "select",
      "press",
      "assert_text",
      "assert_value",
    ];

    if (needsValue.includes(data.action)) {
      return data.value !== undefined && data.value.trim().length > 0;
    }
    return true;
  },
  { message: "Value is required for this action", path: ["value"] },
);

// Main TestCase Schema with target_url
const TestCaseSchema = z.object({
  target_url: z.string().url(),
  intent: z.enum([
    "navigation",
    "form_submission",
    "login",
    "search",
    "data_extraction",
    "validation",
    "interaction",
  ]),
  confidence: z.number().min(0).max(1),
  requires_auth: z.boolean().default(false),
  steps: z.array(StepSchema).min(1),
  recovery_strategy: z
    .object({
      max_attempts: z.number().min(1).max(3),
      fallback_actions: z.array(z.string()),
      screenshot_on_failure: z.boolean(),
    })
    .optional(),
  dynamic_wait_conditions: z
    .array(
      z.object({
        type: z.enum([
          "selector_visible",
          "selector_hidden",
          "network_idle",
          "text_present",
        ]),
        selector: z.string().optional(),
        text: z.string().optional(),
        timeout_ms: z.number(),
      }),
    )
    .optional(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

// ============= Free AI Planner (Updated Models) =============

export class AITestPlanner {
  private groqClient: OpenAI;
  private geminiClient: GoogleGenerativeAI;
  private fallbackModels: Array<{
    provider: "groq" | "gemini";
    model: string;
    client: any;
  }>;

  constructor() {
    // Groq Client (Free)
    this.groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    // Gemini Client (Free)
    this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    // ✅ Updated Free Models (August 2024 - Current)
    this.fallbackModels = [
      // Groq ke naye models (Latest)
      {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        client: this.groqClient,
      }, // Best
      {
        provider: "groq",
        model: "llama-3.1-8b-instant",
        client: this.groqClient,
      }, // Fast
      { provider: "groq", model: "gemma2-9b-it", client: this.groqClient }, // Good
      {
        provider: "groq",
        model: "deepseek-r1-distill-llama-70b",
        client: this.groqClient,
      }, // New

      // Gemini ke naye models
      {
        provider: "gemini",
        model: "gemini-1.5-flash",
        client: this.geminiClient,
      }, // Fast
      {
        provider: "gemini",
        model: "gemini-1.5-pro",
        client: this.geminiClient,
      }, // Powerful
    ];
  }

  async generateTestCase(prompt: string, pageData: any): Promise<TestCase> {
    // Step 1: Analyze intent
    const intent = await this.analyzeIntent(prompt);
    console.log(
      `📊 Detected intent: ${intent.intent} with confidence: ${intent.confidence}`,
    );

    // Step 2: Generate steps with fallback
    const result = await this.generateWithFallback(prompt, pageData, intent);

    // Step 3: Validate output
    const validated = this.validateTestCase(result, pageData);

    // Step 4: Add recovery strategies
    const withRecovery = this.addRecoveryStrategy(validated);

    return withRecovery;
  }

  private async analyzeIntent(
    prompt: string,
  ): Promise<{ intent: string; confidence: number }> {
    const intentPrompt = `
    Analyze this test prompt and return JSON with intent and confidence score.
    Intent types: navigation, form_submission, login, search, data_extraction, validation, interaction
    
    Prompt: "${prompt}"
    
    Return: {"intent": "type", "confidence": 0.95}
    `;

    try {
      const completion = await this.groqClient.chat.completions.create({
        model: "llama-3.1-8b-instant", // ✅ Naya model
        temperature: 0,
        messages: [
          { role: "system", content: "Return only JSON. No explanations." },
          { role: "user", content: intentPrompt },
        ],
      });

      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      return {
        intent: parsed.intent || "interaction",
        confidence: parsed.confidence || 0.7,
      };
    } catch (error) {
      console.warn("Intent analysis failed, using default");
      return { intent: "interaction", confidence: 0.5 };
    }
  }

  private async generateWithFallback(
    prompt: string,
    pageData: any,
    intent: { intent: string; confidence: number },
  ): Promise<any> {
    // Try all free models in sequence
    for (const { provider, model, client } of this.fallbackModels) {
      try {
        console.log(`🆓 Trying FREE ${provider.toUpperCase()} model: ${model}`);

        let content = "";

        if (provider === "groq") {
          const completion = await client.chat.completions.create({
            model: model,
            temperature: intent.confidence > 0.8 ? 0.1 : 0.3,
            messages: [
              {
                role: "system",
                content: this.getSystemPrompt(intent.intent, pageData),
              },
              {
                role: "user",
                content: this.getUserPrompt(prompt, pageData),
              },
            ],
          });
          content = completion.choices[0].message.content || "";
        } else if (provider === "gemini") {
          const geminiModel = client.getGenerativeModel({ model: model });
          const result = await geminiModel.generateContent(`
            ${this.getSystemPrompt(intent.intent, pageData)}
            
            ${this.getUserPrompt(prompt, pageData)}
            
            Remember: Return ONLY valid JSON. No markdown, no explanations.
          `);
          content = result.response.text();
        }

        console.log(`✅ ${provider.toUpperCase()} model responded`);

        // Clean and parse response
        const cleaned = this.cleanResponse(content);
        const parsed = JSON.parse(cleaned);

        // Validate structure
        if (parsed.steps && parsed.steps.length > 0) {
          return {
            target_url: pageData.url,
            ...parsed,
            _model_used: `${provider}/${model}`,
            _confidence: intent.confidence,
          };
        }
      } catch (error) {
        console.warn(`❌ Free model ${provider}/${model} failed:`, error);
        continue;
      }
    }

    throw new Error("All free models failed to generate valid test case");
  }

  private getSystemPrompt(intent: string, pageData: any): string {
    const availableSelectors = this.extractSelectors(pageData);

    return `
You are an expert QA Automation Engineer.

INTENT: ${intent}
TARGET URL: ${pageData.url}
AVAILABLE SELECTORS: ${JSON.stringify(availableSelectors)}

STRICT RULES:
1. Return ONLY valid JSON
2. Use ONLY selectors from available_selectors list
3. Never invent selectors
4. Include wait_after_ms for dynamic content
5. Add retry_count for critical actions
6. Provide description for each step

VALID ACTIONS:
- click: Click an element (requires selector)
- fill: Fill input field (requires selector + value)
- select: Select dropdown option (requires selector + value)
- wait: Wait for time (requires value in ms)
- assert_visible: Verify element visible (requires selector)
- assert_text: Verify text content (requires selector + value)
- hover: Hover over element (requires selector)

RESPONSE FORMAT:
{
  "steps": [
    {
      "action": "click",
      "selector": "#login-btn",
      "wait_after_ms": 1000,
      "retry_count": 2,
      "description": "Click login button"
    }
  ],
  "dynamic_wait_conditions": [
    {
      "type": "selector_visible",
      "selector": "#dashboard",
      "timeout_ms": 5000
    }
  ]
}
`;
  }

  private getUserPrompt(prompt: string, pageData: any): string {
    return `
USER PROMPT: ${prompt}

PAGE DATA:
URL: ${pageData.url}
Title: ${pageData.title || "N/A"}
Available Elements:
${JSON.stringify(this.extractRelevantElements(pageData), null, 2)}

Generate steps to accomplish: "${prompt}"
`;
  }

  private extractSelectors(pageData: any): string[] {
    const selectors: string[] = [];

    const extract = (obj: any) => {
      if (!obj) return;
      if (obj.selector) selectors.push(obj.selector);
      if (obj.id) selectors.push(`#${obj.id}`);
      if (obj.class) selectors.push(`.${obj.class}`);
      if (obj.name) selectors.push(`[name="${obj.name}"]`);
      if (obj.type === "button")
        selectors.push(`button:has-text("${obj.text}")`);
      if (Array.isArray(obj)) obj.forEach(extract);
      if (typeof obj === "object") Object.values(obj).forEach(extract);
    };

    extract(pageData);
    return [...new Set(selectors)];
  }

  private extractRelevantElements(pageData: any): any {
    const elements: any = {};

    if (pageData.buttons) elements.buttons = pageData.buttons;
    if (pageData.inputs) elements.inputs = pageData.inputs;
    if (pageData.forms) elements.forms = pageData.forms;
    if (pageData.links) elements.links = pageData.links;

    if (Object.keys(elements).length === 0 && pageData.html) {
      const inputMatches =
        pageData.html.match(/<input[^>]*id=["']([^"']+)["']/g) || [];
      elements.inputs = inputMatches
        .map((m: string) => m.match(/id=["']([^"']+)["']/)?.[1])
        .filter(Boolean);
    }

    return elements;
  }

  private cleanResponse(content: string): string {
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "");
    cleaned = cleaned.replace(/```json\s*/g, "");
    cleaned = cleaned.replace(/```\s*/g, "");
    cleaned = cleaned.replace(/```javascript\s*/g, "");

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    return jsonMatch[0];
  }

  private validateTestCase(testCase: any, pageData: any): TestCase {
    try {
      const validated = TestCaseSchema.parse({
        target_url: testCase.target_url || pageData.url,
        intent: testCase.intent || "interaction",
        confidence: testCase._confidence || 0.7,
        requires_auth: testCase.requires_auth || false,
        steps: testCase.steps || [],
        recovery_strategy: testCase.recovery_strategy,
        dynamic_wait_conditions: testCase.dynamic_wait_conditions,
      });

      return validated;
    } catch (error) {
      console.error("Validation failed:", error);

      return {
        target_url: pageData.url,
        intent: "interaction",
        confidence: 0.3,
        requires_auth: false,
        steps: [
          {
            action: "wait",
            value: "1000",
            wait_after_ms: 1000,
            retry_count: 1,
            description: "Fallback wait step due to validation error",
            optional: false,
          },
        ],
      };
    }
  }

  private addRecoveryStrategy(testCase: TestCase): TestCase {
    if (!testCase.recovery_strategy) {
      testCase.recovery_strategy = {
        max_attempts: 2,
        fallback_actions: ["refresh_page", "wait_retry"],
        screenshot_on_failure: true,
      };
    }

    if (
      !testCase.dynamic_wait_conditions ||
      testCase.dynamic_wait_conditions.length === 0
    ) {
      testCase.dynamic_wait_conditions = [
        {
          type: "network_idle",
          timeout_ms: 5000,
        },
      ];
    }

    return testCase;
  }
}

// ============= Usage =============

export async function generateTestCase(prompt: string, pageData: any) {
  const planner = new AITestPlanner();
  return await planner.generateTestCase(prompt, pageData);
}
