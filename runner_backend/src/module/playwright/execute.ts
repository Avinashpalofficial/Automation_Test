// ============================================================
// execute.ts  (Runner — playwright execution plane)
//
// PURANA model (SelectorHealer + executeAction switch) HATA DIYA.
// Wo CSS-selector pe chalta tha; Manager ab sirf targetHint bhejta hai,
// isliye selector undefined hota tha -> null.fill() CRASH.
//
// NAYA model:
//   HeuristicResolver  -> targetHint se live Locator dhoondhta hai
//   dispatchStep       -> resolve -> interpolate({{var}}/{{secret}}) -> action
//
// Baaki sab (video, screenshots, manager status updates, job status)
// jaisa tha waisa hi rakha hai.
// ============================================================

import fs from "fs";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { getRunnerJob, updateRunnerJobStatus } from "../job/job_service";
import { uploadToStorage } from "../storage/supabase.storage";
import { sendStatusUpdate } from "../client/manager.client";

import { TestStep } from "@automation/shared/src";
import { HeuristicResolver } from "../execution/selector_resolver";
import {
  dispatchStep,
  DispatchContext,
  ResolutionError,
  StepAssertionError,
} from "../execution/action_dispatcher";

// ============= Configuration =============
const CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_RETRY_COUNT: 1, // resolution/timing flakiness ke liye light retry
  RETRY_DELAY_MS: 1000,
  SCREENSHOT_ON_FAILURE: true,
  VIDEO_RECORDING: true,
};

// ============= Per-step screenshot helper =============
async function takeScreenshot(
  page: Page,
  jobId: string,
  label: string,
): Promise<string> {
  const ts = Date.now();
  const path = `artifacts/${jobId}-${label}-${ts}.png`;
  await page.screenshot({ path, fullPage: true });
  return uploadToStorage(path, `${jobId}-${label}-${ts}.png`, "image/png");
}

// ============= Per-step execution with light retry =============
// dispatchStep andar se Playwright auto-wait karta hai. Retry yahan sirf
// timing/transient cases ke liye hai (e.g. element abhi mount nahi hua).
// AssertionError pe retry NAHI karte — wo deterministic hota hai.
async function executeStepWithRetry(
  step: TestStep,
  index: number,
  page: Page,
  resolver: HeuristicResolver,
  ctx: DispatchContext,
  jobId: string,
) {
  const maxRetries = step.retryCount ?? CONFIG.DEFAULT_RETRY_COUNT;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `🎬 Step ${index + 1}: ${step.action} → "${step.targetHint ?? "—"}" (attempt ${attempt + 1})`,
      );

      const res = await dispatchStep(step, page, resolver, ctx);
      const screenshot = await takeScreenshot(page, jobId, `step-${index}`);

      console.log(
        res.status === "skipped"
          ? `⏭️  Step ${index + 1} skipped: ${res.reason}`
          : `✅ Step ${index + 1} done`,
      );

      return { ...res, screenshot, attempt };
    } catch (err) {
      lastErr = err as Error;

      // Assertion fail = deterministic, retry bekaar. Seedha bubble.
      if (err instanceof StepAssertionError) break;

      // Resolution/transient → ek baar wait karke retry karo
      if (attempt < maxRetries) {
        console.log(`🔄 Step ${index + 1} retry in ${CONFIG.RETRY_DELAY_MS}ms`);
        await page.waitForTimeout(CONFIG.RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastErr;
}

// ============= Main Execution Function =============
export async function playwrightExecute(jobId: string) {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    if (!fs.existsSync("artifacts")) fs.mkdirSync("artifacts");
    if (!fs.existsSync("videos")) fs.mkdirSync("videos");

    console.log("🎭 PLAYWRIGHT EXECUTION STARTED | Job:", jobId);

    await updateRunnerJobStatus(jobId, "running");
    const jobDetails = await getRunnerJob(jobId);
    console.log("📦 Job:", JSON.stringify(jobDetails, null, 2));

    await sendStatusUpdate(jobId, "running");

    // ── Browser ──
    browser = await chromium.launch({
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const contextOptions: any = {
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    };
    if (CONFIG.VIDEO_RECORDING) {
      contextOptions.recordVideo = {
        dir: "videos/",
        size: { width: 1280, height: 720 },
      };
    }

    context = await browser.newContext(contextOptions);
    page = await context.newPage();
    page.setDefaultTimeout(CONFIG.DEFAULT_TIMEOUT);

    page.on("dialog", async (dialog) => {
      console.log(`🔔 Dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    console.log("🔗 Navigating:", jobDetails.target_url);
    await page.goto(jobDetails.target_url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log("✅ URL loaded");

    // ── NAYA engine: resolver + dispatcher ──
    const resolver = new HeuristicResolver();
    const ctx: DispatchContext = {
      captured: {},
      // TODO: library/secret resolution yahan inject hoga (token → plaintext).
      // Abhi job pe secrets ho to le lo, warna khaali.
      secrets: (jobDetails as any).secrets ?? {},
    };

    const steps: TestStep[] = jobDetails.steps;
    const logs: any[] = [];
    let allStepsPassed = true;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        const result = await executeStepWithRetry(
          step,
          i,
          page,
          resolver,
          ctx,
          jobId,
        );
        logs.push({
          step: i + 1,
          action: step.action,
          targetHint: step.targetHint,
          status: result.status,
          screenshot: result.screenshot,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        // optional step fail ho to continue
        if (step.optional) {
          console.log(`⚠️  Optional step ${i + 1} failed, continuing...`);
          logs.push({
            step: i + 1,
            action: step.action,
            status: "skipped",
            reason: err.message,
          });
          continue;
        }

        // Error type se pata: resolution vs assertion vs other
        let errorType = "other";
        if (err instanceof ResolutionError) errorType = "resolution";
        else if (err instanceof StepAssertionError) errorType = "assertion";

        console.error(`💥 Step ${i + 1} FAILED [${errorType}]: ${err.message}`);

        if (CONFIG.SCREENSHOT_ON_FAILURE) {
          const failureUrl = await takeScreenshot(page, jobId, "failure");
          console.log("📸 Failure screenshot:", failureUrl);
        }

        allStepsPassed = false;
        await updateRunnerJobStatus(jobId, "failed", err.message);
        await sendStatusUpdate(
          jobId,
          "failed",
          undefined,
          undefined,
          err.message,
        );
        // pehli hard failure pe ruko
        throw err;
      }
    }

    // ── Final screenshot ──
    const screenshotUrl = await takeScreenshot(page, jobId, "final");

    // ── Video (context band karne ke baad finalize hota hai) ──
    let videoUrl = "";
    try {
      const video = page.video();
      if (video) {
        await context.close(); // video finalize
        const videoPath = await video.path();
        if (videoPath && fs.existsSync(videoPath)) {
          const stats = fs.statSync(videoPath);
          if (stats.size > 0) {
            videoUrl = await uploadToStorage(
              videoPath,
              `${jobId}.webm`,
              "video/webm",
            );
            console.log(
              `✅ Video uploaded (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
            );
          }
        }
      } else {
        await context.close();
      }
    } catch (videoErr) {
      console.error("❌ Video processing failed:", videoErr);
      if (context && !context.isClosed?.()) await context.close();
    }

    const finalStatus = allStepsPassed ? "passed" : "failed";
    await updateRunnerJobStatus(jobId, finalStatus);
    await sendStatusUpdate(jobId, finalStatus, screenshotUrl, videoUrl);

    console.log(`🎉 TEST ${finalStatus.toUpperCase()}`);
    console.log("📊 Logs:", JSON.stringify(logs, null, 2));
  } catch (error: any) {
    console.error("💥 PLAYWRIGHT FATAL:", error);
    await updateRunnerJobStatus(jobId, "failed", error.message);
    await sendStatusUpdate(
      jobId,
      "failed",
      undefined,
      undefined,
      error.message,
    );
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log("🔒 Browser closed");
    }
  }
}
