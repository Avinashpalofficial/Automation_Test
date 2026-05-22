import express from "express";
import {
  createTestCaseController,
  runTestCaseController,
} from "../module/workspace_test_case/test_case.controller";
import { authenticate } from "../middleware/auth.middleware";

const testCaseRouter = express.Router();

testCaseRouter.post("/test-cases", authenticate, createTestCaseController);
testCaseRouter.post(
  "/test-cases/:testCaseId/run",
  authenticate,
  runTestCaseController,
);

export default testCaseRouter;
