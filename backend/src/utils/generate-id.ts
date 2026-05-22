// utils/generate-id.ts

import crypto from "crypto";

export function generateWorkspaceId() {
  return `ws_${crypto.randomBytes(5).toString("hex")}`;
}

export function generateInviteId() {
  return `inv_${crypto.randomBytes(5).toString("hex")}`;
}

export function generateSuiteId() {
  return `suite_${crypto.randomBytes(5).toString("hex")}`;
}

export function generateTestCaseId() {
  return `tc_${crypto.randomBytes(5).toString("hex")}`;
}

export function generateExecutionId() {
  return `job_${crypto.randomBytes(5).toString("hex")}`;
}
