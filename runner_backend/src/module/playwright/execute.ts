import fs from "fs";
import { chromium } from "playwright";
import { getRunnerJob } from "../job/job_service";
import { uploadToStorage } from "../storage/supabase.storage";
import { sendStatusUpdate } from "../client/manager.client";
import { updateRunnerJobStatus } from "../job/job_service";

// ============= Configuration =============
const CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_RETRY_COUNT: 2,
  RETRY_DELAY_MS: 1000,
  SCREENSHOT_ON_FAILURE: true,
  VIDEO_RECORDING: true,
};

// ============= Self-Healing Selector Engine =============
class SelectorHealer {
  private alternativeSelectors: Map<string, string[]> = new Map();

  constructor(private page: any) {}

  async findElement(
    originalSelector: string,
    retryCount: number = 0,
  ): Promise<any> {
    try {
      // Try original selector first
      const element = await this.page.$(originalSelector);
      if (element) return element;

      // Try cached alternative selectors
      if (this.alternativeSelectors.has(originalSelector)) {
        const alternatives = this.alternativeSelectors.get(originalSelector)!;
        for (const alt of alternatives) {
          const altElement = await this.page.$(alt);
          if (altElement) {
            console.log(
              `🔄 Self-healing: Found element with alternative selector "${alt}"`,
            );
            return altElement;
          }
        }
      }

      // Generate dynamic alternatives
      const dynamicSelectors = this.generateDynamicSelectors(originalSelector);
      for (const dynamic of dynamicSelectors) {
        const element = await this.page.$(dynamic);
        if (element) {
          console.log(
            `🔄 Self-healing: Generated working selector "${dynamic}"`,
          );
          this.cacheSelector(originalSelector, dynamic);
          return element;
        }
      }

      // Wait and retry for dynamic content
      if (retryCount < 3) {
        await this.page.waitForTimeout(1000 * (retryCount + 1));
        return this.findElement(originalSelector, retryCount + 1);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private generateDynamicSelectors(selector: string): string[] {
    const alternatives: string[] = [];

    // Handle dynamic IDs (e.g., user_123 → user_*)
    if (selector.includes("_")) {
      const parts = selector.split("_");
      if (parts.length > 1) {
        alternatives.push(`${parts[0]}_*`);
        alternatives.push(`[id^="${parts[0]}_"]`);
      }
    }

    // Handle data-testid attributes
    const testIdMatch = selector.match(/data-testid=["']([^"']+)["']/);
    if (testIdMatch) {
      alternatives.push(`[data-testid="${testIdMatch[1]}"]`);
    }

    // Handle class-based selectors with partial match
    if (selector.startsWith(".")) {
      const className = selector.substring(1);
      alternatives.push(`[class*="${className}"]`);
    }

    return alternatives;
  }

  private cacheSelector(original: string, working: string) {
    if (!this.alternativeSelectors.has(original)) {
      this.alternativeSelectors.set(original, []);
    }
    this.alternativeSelectors.get(original)!.push(working);
  }
}

// ============= Step Executor with Retries =============
class StepExecutor {
  private selectorHealer: SelectorHealer;
  private executionLogs: any[] = [];

  constructor(
    private page: any,
    private jobId: string,
  ) {
    this.selectorHealer = new SelectorHealer(page);
  }

  async executeStep(step: any, stepIndex: number): Promise<any> {
    const retryCount = step.retry_count || CONFIG.DEFAULT_RETRY_COUNT;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryCount + 1; attempt++) {
      try {
        console.log(
          `🎬 Executing step ${stepIndex + 1}: ${step.action} (Attempt ${attempt})`,
        );

        // Execute action based on type
        await this.executeAction(step);

        // Dynamic wait based on action type
        await this.smartWait(step);

        // Take screenshot after step
        const screenshotUrl = await this.takeStepScreenshot(stepIndex);

        // Log success
        const log = {
          step: stepIndex + 1,
          action: step.action,
          selector: step.selector,
          value: step.value,
          attempt,
          status: "passed",
          screenshot: screenshotUrl,
          timestamp: new Date().toISOString(),
        };
        this.executionLogs.push(log);

        console.log(`✅ Step ${stepIndex + 1} completed successfully`);
        return log;
      } catch (error: any) {
        lastError = error;
        console.error(
          `❌ Step ${stepIndex + 1} failed (Attempt ${attempt}):`,
          error.message,
        );

        if (attempt <= retryCount) {
          console.log(
            `🔄 Retrying step ${stepIndex + 1} in ${CONFIG.RETRY_DELAY_MS}ms...`,
          );
          await this.page.waitForTimeout(CONFIG.RETRY_DELAY_MS * attempt);

          // Attempt recovery
          await this.attemptRecovery(step);
        } else {
          // Final failure
          const log = {
            step: stepIndex + 1,
            action: step.action,
            selector: step.selector,
            value: step.value,
            attempt,
            status: "failed",
            error: error.message,
            timestamp: new Date().toISOString(),
          };
          this.executionLogs.push(log);
          throw error;
        }
      }
    }

    throw lastError;
  }

  private async executeAction(step: any) {
    const { action, selector, value } = step;

    // Find element with self-healing
    let element = null;
    if (selector) {
      element = await this.selectorHealer.findElement(selector);
      if (!element && action !== "wait" && action !== "navigate") {
        throw new Error(`Element not found: ${selector}`);
      }
    }

    switch (action) {
      case "fill":
        await element.fill(value);
        break;

      case "click":
        await element.click();
        break;

      case "select":
        await element.selectOption(value);
        break;

      case "hover":
        await element.hover();
        break;

      case "scroll":
        await element.scrollIntoViewIfNeeded();
        break;

      case "press":
        await this.page.keyboard.press(value);
        break;

      case "navigate":
        await this.page.goto(value || step.url, {
          waitUntil: "networkidle",
          timeout: CONFIG.DEFAULT_TIMEOUT,
        });
        break;

      // Assertions
      case "assert_visible":
        const isVisible = await element.isVisible();
        if (!isVisible) throw new Error(`Element ${selector} is not visible`);
        break;

      case "assert_text":
        const actualText = await element.textContent();
        if (!actualText?.includes(value)) {
          throw new Error(
            `Expected text "${value}" not found. Got: "${actualText}"`,
          );
        }
        break;

      case "assert_value":
        const actualValue = await element.inputValue();
        if (actualValue !== value) {
          throw new Error(`Expected value "${value}" but got "${actualValue}"`);
        }
        break;

      case "wait":
        const waitTime = parseInt(value || "1000");
        await this.page.waitForTimeout(waitTime);
        break;

      case "wait_for_selector":
        await this.page.waitForSelector(selector, {
          state: "visible",
          timeout: CONFIG.DEFAULT_TIMEOUT,
        });
        break;

      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  private async smartWait(step: any) {
    // Dynamic wait based on action type
    let waitTime = step.wait_after_ms || 500;

    switch (step.action) {
      case "click":
        waitTime = 1000; // Wait for navigation/animations
        break;
      case "fill":
        waitTime = 300; // Brief wait for input validation
        break;
      case "navigate":
        waitTime = 2000; // Wait for page load
        break;
      case "select":
        waitTime = 500;
        break;
      default:
        waitTime = 500;
    }

    // Wait for network idle after critical actions
    if (["click", "navigate", "submit"].includes(step.action)) {
      await this.page.waitForLoadState("networkidle").catch(() => {});
    }

    await this.page.waitForTimeout(waitTime);
  }

  private async attemptRecovery(step: any) {
    console.log("🛠️ Attempting recovery...");

    // Refresh page if navigation step failed
    if (step.action === "navigate") {
      await this.page.reload();
      await this.page.waitForLoadState("networkidle");
    }

    // Wait for dynamic content
    if (step.selector) {
      try {
        await this.page.waitForSelector(step.selector, { timeout: 5000 });
      } catch (e) {
        // Ignore timeout
      }
    }
  }

  private async takeStepScreenshot(stepIndex: number): Promise<string> {
    const timestamp = Date.now();
    const stepScreenshotPath = `artifacts/${this.jobId}-step-${stepIndex}-${timestamp}.png`;
    await this.page.screenshot({ path: stepScreenshotPath, fullPage: true });
    return await uploadToStorage(
      stepScreenshotPath,
      `${this.jobId}-step-${stepIndex}-${timestamp}.png`,
      "image/png",
    );
  }

  getLogs() {
    return this.executionLogs;
  }
}

// ============= Dynamic Wait Conditions Handler =============
class WaitConditionHandler {
  constructor(private page: any) {}

  async handleWaitConditions(waitConditions: any[]) {
    if (!waitConditions || waitConditions.length === 0) return;

    for (const condition of waitConditions) {
      console.log(`⏳ Handling wait condition: ${condition.type}`);

      switch (condition.type) {
        case "selector_visible":
          await this.page.waitForSelector(condition.selector, {
            state: "visible",
            timeout: condition.timeout_ms || CONFIG.DEFAULT_TIMEOUT,
          });
          break;

        case "selector_hidden":
          await this.page.waitForSelector(condition.selector, {
            state: "hidden",
            timeout: condition.timeout_ms || CONFIG.DEFAULT_TIMEOUT,
          });
          break;

        case "network_idle":
          await this.page.waitForLoadState("networkidle", {
            timeout: condition.timeout_ms || CONFIG.DEFAULT_TIMEOUT,
          });
          break;

        case "text_present":
          await this.page.waitForFunction(
            (text: string) => document.body.innerText.includes(text),
            condition.text,
            { timeout: condition.timeout_ms || CONFIG.DEFAULT_TIMEOUT },
          );
          break;

        default:
          console.warn(`Unknown wait condition: ${condition.type}`);
      }
    }
  }
}

// ============= Main Execution Function =============
export async function playwrightExecute(jobId: string) {
  let browser;
  let context;
  let page;

  try {
    // Create directories
    if (!fs.existsSync("artifacts")) fs.mkdirSync("artifacts");
    if (!fs.existsSync("videos")) fs.mkdirSync("videos");

    console.log("🎭 PLAYWRIGHT EXECUTION STARTED");
    console.log("📋 Job ID:", jobId);

    // Update job status
    await updateRunnerJobStatus(jobId, "running");
    const jobDetails = await getRunnerJob(jobId);
    console.log("📦 Job Details:", JSON.stringify(jobDetails, null, 2));

    // Notify manager
    await sendStatusUpdate(jobId, "running");

    // Launch browser with better options
    browser = await chromium.launch({
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"], // Avoid detection
    });
    console.log("🌐 Browser launched");

    // Create context with video recording
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
    console.log("📄 Page created");

    // Set default timeout
    page.setDefaultTimeout(CONFIG.DEFAULT_TIMEOUT);

    // Handle dialogs automatically
    page.on("dialog", async (dialog: any) => {
      console.log(`🔔 Dialog detected: ${dialog.message()}`);
      await dialog.accept();
    });

    // Navigate to URL
    console.log("🔗 Navigating to:", jobDetails.target_url);
    await page.goto(jobDetails.target_url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Handle dynamic wait conditions
    if (jobDetails.dynamic_wait_conditions) {
      const waitHandler = new WaitConditionHandler(page);
      await waitHandler.handleWaitConditions(
        jobDetails.dynamic_wait_conditions,
      );
    }

    console.log("✅ URL loaded");

    // Execute steps with retries and self-healing
    const executor = new StepExecutor(page, jobId);
    let allStepsPassed = true;

    for (let i = 0; i < jobDetails.steps.length; i++) {
      try {
        // Check if step is optional
        if (jobDetails.steps[i].optional) {
          try {
            await executor.executeStep(jobDetails.steps[i], i);
          } catch (error) {
            console.log(`⚠️ Optional step ${i + 1} failed but continuing...`);
          }
        } else {
          await executor.executeStep(jobDetails.steps[i], i);
        }
      } catch (error: any) {
        allStepsPassed = false;
        console.error(`💥 Critical failure at step ${i + 1}:`, error.message);

        // Take failure screenshot
        if (CONFIG.SCREENSHOT_ON_FAILURE) {
          const failureScreenshotPath = `artifacts/${jobId}-failure-${Date.now()}.png`;
          await page.screenshot({
            path: failureScreenshotPath,
            fullPage: true,
          });
          const failureUrl = await uploadToStorage(
            failureScreenshotPath,
            `${jobId}-failure.png`,
            "image/png",
          );
          console.log("📸 Failure screenshot uploaded:", failureUrl);
        }

        await updateRunnerJobStatus(jobId, "failed", error.message);
        await sendStatusUpdate(
          jobId,
          "failed",
          undefined,
          undefined,
          error.message,
        );
        throw error;
      }
    }

    // Final screenshot
    // ============= In your playwrightExecute function =============

    // Final screenshot
    const finalScreenshotPath = `artifacts/${jobId}-final.png`;
    await page.screenshot({ path: finalScreenshotPath, fullPage: true });
    const screenshotUrl = await uploadToStorage(
      finalScreenshotPath,
      `${jobId}-final.png`,
      "image/png",
    );

    // Handle video with proper null checking
    let videoUrl = "";

    try {
      const video = page.video();

      if (video) {
        console.log("🎥 Video recording found, saving...");

        // Close context to finalize video
        await context.close();

        // Get video path
        const videoPath = await video.path();

        if (videoPath && fs.existsSync(videoPath)) {
          const videoStats = fs.statSync(videoPath);
          if (videoStats.size > 0) {
            videoUrl = await uploadToStorage(
              videoPath,
              `${jobId}.webm`,
              "video/webm",
            );
            console.log(
              `✅ Video uploaded (${(videoStats.size / 1024 / 1024).toFixed(2)} MB):`,
              videoUrl,
            );
          } else {
            console.log("⚠️ Video file is empty");
          }
        } else {
          console.log("⚠️ Video path is invalid or file missing");
        }
      } else {
        console.log("ℹ️ No video recording available for this session");
        await context.close();
      }
    } catch (videoError) {
      console.error("❌ Failed to process video:", videoError);
      // Ensure context is closed even if video fails
      if (context && !context.isClosed()) {
        await context.close();
      }
    }

    // Update final status
    const finalStatus = allStepsPassed ? "passed" : "failed";
    await updateRunnerJobStatus(jobId, finalStatus);
    await sendStatusUpdate(jobId, finalStatus, screenshotUrl, videoUrl);

    console.log(`🎉 TEST ${finalStatus.toUpperCase()}`);
    console.log(
      "📊 Execution Logs:",
      JSON.stringify(executor.getLogs(), null, 2),
    );
  } catch (error: any) {
    console.error("💥 PLAYWRIGHT FATAL ERROR:", error);
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
    // Cleanup
    if (browser) {
      await browser.close();
      console.log("🔒 Browser closed");
    }
  }
}
