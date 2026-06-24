export type GoalType =
  | "navigate" // url pe jana
  | "find_element" // search krna
  | "interact" //click,fill,select
  | "extract_value"
  | "assert" //verify karna
  | "wait_condition" //kuch hone ka wait krna
  | "conditional"; //agar X ho to Y kro

export interface AtomicGoal {
  id: string; // "goal_1", "goal_2"
  type: GoalType;
  description: string; // Human readable
  dependsOn: string[]; // konsa goal phle complete hona chiye  example ["goal_1","goal_2"]
  requiredContext: string[]; //  what values are needed to execute this goal  |  example: ["product_url", "cart_item_id"]
  produceContext: string[]; // Will these values ​​produce this goal?
  possibleFailure: string[]; // what could go wrong with this goal
  condition?: {
    type: "if_exists" | "if_visible" | "if_value_equals";
    target: string;
    fallback?: string; // Agar condition fail ho toh kya karein
  };
  expectsNavigation: boolean; // page navigation like login to dashoboard
}

export interface ParsedIntent {
  originalPrompt: string;

  summary: string; // High level summary
  overallComplexity: "simple" | "medium" | "complex" | "very_complex";

  goals: AtomicGoal[]; // Goals in order with dependencies

  // Execution order based on dependency graph
  executionOrder: string[][]; // [[goal_1], [goal_2, goal_3], [goal_4]]
  // Inner array = parallel execute kar sakte hain

  requiresAuth: boolean; // Auth chahiye?
  authHint?: "login" | "signup" | "guest_checkout";

  userProvidedValues: Record<string, string>; // Kya user ne values specify ki hain ya AI dhundhega?// { coupon: "SAVE10" }
  valuesToCapture: string[]; // ["order_id", "total_price"]

  riskFlags: RiskFlag[]; // Risk flags

  confidence: number; // Confidence
  ambiguities: string[]; // Jo unclear hai prompt mein
}
export interface RiskFlag {
  type:
    | "auth_required"
    | "payment_involved"
    | "destructive_action"
    | "external_dependency"
    | "rate_limited"
    | "captcha_likely";
  description: string;
  severity: "low" | "medium" | "high" | "blocker";
}
