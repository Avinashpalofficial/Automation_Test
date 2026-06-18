import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedIntent, RiskFlag } from "./intent_parser_type";

export class IntentParser {
  private groqClient: OpenAI;
  private geminiClient: GoogleGenerativeAI;
  private openRouterClient: OpenAI;
  private fallbackModels: Array<{
    provider: "groq" | "gemini" | "openrouter";
    model: string;
    client: any;
  }>;

  constructor() {
    this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.openRouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
    this.groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    this.fallbackModels = [
      {
        provider: "gemini",
        model: "gemini-2.5-flash",
        client: this.geminiClient,
      }, // Fast
      {
        provider: "gemini",
        model: "gemini-1.5-pro",
        client: this.geminiClient,
      }, // Powerful

      {
        provider: "openrouter",
        model: "deepseek/deepseek-chat-v3-0324:free",
        client: this.openRouterClient,
      },
      {
        provider: "openrouter",
        model: "qwen/qwen3-32b:free",
        client: this.openRouterClient,
      },
      {
        provider: "openrouter",
        model: "meta-llama/llama-3.3-70b-instruct:free",
        client: this.openRouterClient,
      },
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
    ];
  }
  async parse(prompt: string, pageurl: string): Promise<ParsedIntent> {
    const decomposed = await this.decomposePrompt(prompt, pageurl); //Raw decomposition
    const withDependencies = this.buildDependencyGraph(decomposed); //build dependency graph
    const withvalues = this.extractUserValues(prompt, withDependencies); //extract user provided values
    const withRisk = this.assessRisks(withvalues); // Risk assessment
    const final = this.calculateExecutionOrder(withRisk); //Calculate execution order
    return final;
  }
  /** Decompose */
  private async decomposePrompt(
    prompt: string,
    pageurl: string,
  ): Promise<Partial<ParsedIntent>> {
    const systemPrompt = `
You are an expert at decomposing natural language test instructions into atomic goals.

RULES:
1. Break every compound action into its smallest meaningful unit
2. Identify what each goal needs as INPUT (from previous goals or user)
3. Identify what each goal PRODUCES (values for future goals)
4. Identify navigation boundaries (when page will change)
5. Flag conditional steps explicitly

GOAL TYPES:
- navigate: Go to a URL or click a link to change page
- find_element: Locate something on page (product, menu item)
- interact: Click, fill, select, hover
- extract_value: Capture text/value for later use (price, ID, name)  
- assert: Verify something is true
- wait_condition: Wait for something to appear/disappear
- conditional: If X then Y else Z

Return ONLY valid JSON, no explanation.
`;

    const userPrompt = `
URL: ${pageurl}
User Prompt: "${prompt}"

Decompose this into atomic goals. Return:
{
  "summary": "one line summary",
  "overallComplexity": "simple|medium|complex|very_complex",
  "goals": [
    {
      "id": "goal_1",
      "type": "navigate|find_element|interact|extract_value|assert|wait_condition|conditional",
      "description": "what this goal does",
      "dependsOn": [],
      "requiredContext": [],
      "producesContext": [],
      "possibleFailures": [],
      "expectsNavigation": false
    }
  ],
  "requiresAuth": false,
  "authHint": null,
  "ambiguities": []
}
`;
    for (const { provider, model, client } of this.fallbackModels) {
      try {
        let content = "";
        if (provider === "groq" || provider === "openrouter") {
          const response = await client.chat.completions.create({
            model,
            temperature: 0,
            response_format: { type: "json_object" },
            message: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
          content = response.choices[0].message.content || "";
        } else if (provider === "gemini") {
          const geminiModel = client.getGenerativeModel({
            model,
          });
          const result = await geminiModel.generateContent(`
${systemPrompt}

${userPrompt}

Return ONLY valid JSON.
`);

          content = result.response.text();
        }

        const parsed = JSON.parse(content);

        return {
          originalPrompt: prompt,
          ...parsed,
        };
      } catch (error) {
        console.warn(`${provider}/${model} failed`, error);
      }
    }
    return {
      originalPrompt: prompt,
      goals: [],
      ambiguities: ["All AI providers failed"],
    };
  }
  /**build deep dependency graph */
  private buildDependencyGraph(
    intent: Partial<ParsedIntent>,
  ): Partial<ParsedIntent> {
    const goals = intent.goals || [];
    for (const goal of goals) {
      for (const required of goal.requiredContext) {
        for (const other of goals) {
          if (
            other.id !== goal.id &&
            other.produceContext.includes(required) &&
            !goal.dependsOn.includes(other.id)
          ) {
            goal.dependsOn.push(other.id);
          }
        }
      }
    }
    return { ...intent, goals };
  }

  /**extract user provided values */
  private extractUserValues(
    prompt: string,
    intent: Partial<ParsedIntent>,
  ): Partial<ParsedIntent> {
    const userProvidedValues: Record<string, string> = {};
    const valuesToCapture: string[] = [];

    // Common patterns jo users typically specify karte hain
    const patterns = [
      // Coupon codes
      {
        regex: /coupon\s+(?:code\s+)?['""]?([A-Z0-9]+)['""]?/gi,
        key: "coupon_code",
      },
      // Quantities
      { regex: /(?:quantity|qty)\s+(?:of\s+)?(\d+)/gi, key: "quantity" },
      // Specific products
      {
        regex: /(?:add|buy|purchase)\s+(?:a\s+)?["']([^"']+)["']/gi,
        key: "product_name",
      },
      // Email addresses
      {
        regex: /(?:email|username)\s+["']?([^\s"']+@[^\s"']+)["']?/gi,
        key: "email",
      },
      // Prices mentioned by user
      {
        regex: /(?:under|below|max)\s+(?:rs\.?|₹|inr)?\s*(\d+)/gi,
        key: "max_price",
      },
      // Size/variant
      { regex: /(?:size|variant)\s+["']?([^\s"',]+)["']?/gi, key: "variant" },
    ];

    for (const { regex, key } of patterns) {
      const match = regex.exec(prompt);
      if (match) {
        userProvidedValues[key] = match[1];
      }
    }

    // Determine what needs to be captured during execution
    for (const goal of intent.goals || []) {
      valuesToCapture.push(...goal.produceContext);
    }

    return {
      ...intent,
      userProvidedValues,
      valuesToCapture: [...new Set(valuesToCapture)],
    };
  }
  /**Risk assessment */
  private assessRisks(intent: Partial<ParsedIntent>): Partial<ParsedIntent> {
    const riskFlags: RiskFlag[] = [];
    const prompt = intent.originalPrompt?.toLowerCase() || "";
    const goals = intent.goals || [];

    // Auth required check
    if (
      prompt.includes("checkout") ||
      prompt.includes("order") ||
      prompt.includes("account") ||
      prompt.includes("profile") ||
      intent.requiresAuth
    ) {
      riskFlags.push({
        type: "auth_required",
        description: "Flow likely requires user to be logged in",
        severity: "high",
      });
    }

    // Payment involved
    if (
      prompt.includes("pay") ||
      prompt.includes("checkout") ||
      prompt.includes("purchase") ||
      prompt.includes("buy")
    ) {
      riskFlags.push({
        type: "payment_involved",
        description: "Payment step detected — cross-origin iframe likely",
        severity: "blocker",
      });
    }

    // Destructive actions
    const destructiveKeywords = [
      "delete",
      "remove",
      "cancel",
      "clear",
      "reset",
    ];
    if (destructiveKeywords.some((k) => prompt.includes(k))) {
      riskFlags.push({
        type: "destructive_action",
        description: "Destructive action detected — cannot be undone",
        severity: "medium",
      });
    }

    // CAPTCHA likely
    if (
      prompt.includes("signup") ||
      prompt.includes("register") ||
      prompt.includes("checkout")
    ) {
      riskFlags.push({
        type: "captcha_likely",
        description: "Registration/checkout flows often have CAPTCHA",
        severity: "medium",
      });
    }

    return { ...intent, riskFlags };
  }
  /**calculate execution order */
  private calculateExecutionOrder(intent: Partial<ParsedIntent>): ParsedIntent {
    const goals = intent.goals || [];
    const executed = new Set<string>();
    const executionOrder: string[][] = [];

    // Topological sort — goals jo parallel chal sakte hain
    // unhe same batch mein daalo
    let remaining = [...goals];

    while (remaining.length > 0) {
      // Goals jinke saare dependencies already executed hain
      const ready = remaining.filter((goal) =>
        goal.dependsOn.every((dep) => executed.has(dep)),
      );

      if (ready.length === 0) {
        // Circular dependency — fallback to sequential
        console.warn(
          "Circular dependency detected, falling back to sequential",
        );
        executionOrder.push([remaining[0].id]);
        executed.add(remaining[0].id);
        remaining = remaining.slice(1);
        continue;
      }

      // Is batch mein daalo
      executionOrder.push(ready.map((g) => g.id));
      ready.forEach((g) => executed.add(g.id));
      remaining = remaining.filter((g) => !executed.has(g.id));
    }

    return {
      originalPrompt: intent.originalPrompt || "",
      summary: intent.summary || "",
      overallComplexity: intent.overallComplexity || "medium",
      goals,
      executionOrder,
      requiresAuth: intent.requiresAuth || false,
      authHint: intent.authHint,
      userProvidedValues: intent.userProvidedValues || {},
      valuesToCapture: intent.valuesToCapture || [],
      riskFlags: intent.riskFlags || [],
      confidence: this.calculateConfidence(intent as ParsedIntent),
      ambiguities: intent.ambiguities || [],
    };
  }

  private calculateConfidence(intent: ParsedIntent): number {
    let confidence = 1.0;

    // Ambiguities reduce confidence
    confidence -= intent.ambiguities.length * 0.1;

    // Blocker risks severely reduce confidence
    const blockers = intent.riskFlags.filter((r) => r.severity === "blocker");
    confidence -= blockers.length * 0.3;

    // High risks moderately reduce confidence
    const highRisks = intent.riskFlags.filter((r) => r.severity === "high");
    confidence -= highRisks.length * 0.15;

    // Very complex flows have lower confidence
    if (intent.overallComplexity === "very_complex") confidence -= 0.2;
    if (intent.overallComplexity === "complex") confidence -= 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}
