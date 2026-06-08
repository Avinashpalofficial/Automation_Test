import { Router } from "express";
import { generateAiTestCaseController } from "../module/ai_layer/ai_generate_test_case/ai_generate_test_case.controller";
import { aiGenerateController } from "../module/ai_layer/ai_planner/ai_planner.controller";
import { authenticate } from "../middleware/auth.middleware";

const AIrouter = Router();

AIrouter.post("/generate-test-case", authenticate, aiGenerateController);
AIrouter.post("/generate-and-run", authenticate, generateAiTestCaseController);

export default AIrouter;
