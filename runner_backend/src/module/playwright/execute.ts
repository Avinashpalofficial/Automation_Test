import fs from "fs";

import { chromium } from "playwright";

import { getRunnerJob } from "../job/job_service";

import { uploadToStorage } from "../storage/supabase.storage";

import { sendStatusUpdate } from "../client/manager.client";
import { updateRunnerJobStatus } from "../job/job_service";
export async function playwrightExecute(jobId: string) {
  let browser;

  try {
    /*
      ensure folders exist
    */

    if (!fs.existsSync("artifacts")) {
      fs.mkdirSync("artifacts");
    }

    if (!fs.existsSync("videos")) {
      fs.mkdirSync("videos");
    }

    console.log("PLAYWRIGHT STARTED");

    /*
      fetch job
    */
    await updateRunnerJobStatus(jobId, "running");
    const jobDetails = await getRunnerJob(jobId);

    console.log("JOB DETAILS:", jobDetails);

    /*
      notify manager
    */

    await sendStatusUpdate(jobId, "running");

    /*
      launch browser
    */

    browser = await chromium.launch({
      headless: false,
    });

    console.log("BROWSER OPENED");

    /*
      create context
    */

    const context = await browser.newContext({
      recordVideo: {
        dir: "videos/",

        size: {
          width: 1280,
          height: 720,
        },
      },
    });

    /*
      create page
    */

    const page = await context.newPage();

    console.log("PAGE CREATED");

    /*
      open url
    */

    await page.goto(jobDetails.target_url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("URL OPENED");

    /*
      execution logs
    */

    const executionLogs = [];

    /*
      execute steps
    */

    for (const step of jobDetails.steps) {
      try {
        console.log("EXECUTING STEP:", step);

        /*
          fill
        */

        if (step.action === "fill") {
          await page.fill(step.selector, step.value);

          console.log(`FILLED: ${step.selector}`);
        }

        /*
          click
        */

        if (step.action === "click") {
          await page.click(step.selector);

          console.log(`CLICKED: ${step.selector}`);
        }

        /*
          wait
        */

        await page.waitForTimeout(2000);

        /*
          step screenshot
        */

        const timestamp = Date.now();

        const stepScreenshotPath = `artifacts/${jobId}-${timestamp}.png`;

        await page.screenshot({
          path: stepScreenshotPath,

          fullPage: true,
        });

        console.log("STEP SCREENSHOT DONE");

        /*
          upload screenshot
        */
        await updateRunnerJobStatus(jobId, "passed");
        const stepScreenshotUrl = await uploadToStorage(
          stepScreenshotPath,

          `${jobId}-${timestamp}.png`,

          "image/png",
        );

        /*
          logs
        */

        executionLogs.push({
          action: step.action,

          selector: step.selector,

          status: "passed",

          screenshot: stepScreenshotUrl,
        });
      } catch (error: any) {
        console.error("STEP FAILED:", error);
        await updateRunnerJobStatus(jobId, "failed", error.message);
        executionLogs.push({
          action: step.action,

          selector: step.selector,

          status: "failed",

          error: error.message,
        });

        /*
          fail execution
        */

        throw error;
      }
    }

    /*
      final screenshot
    */

    const finalScreenshotPath = `artifacts/${jobId}-final.png`;

    await page.screenshot({
      path: finalScreenshotPath,

      fullPage: true,
    });

    console.log("FINAL SCREENSHOT DONE");

    /*
      upload final screenshot
    */

    const screenshotUrl = await uploadToStorage(
      finalScreenshotPath,

      `${jobId}-final.png`,

      "image/png",
    );

    /*
      get video BEFORE context close
    */

    const video = page.video();

    /*
      close context
      required for video save
    */

    await context.close();

    /*
      upload video
    */

    let videoUrl = "";

    if (video) {
      const videoPath = await video.path();

      console.log("VIDEO PATH:", videoPath);

      videoUrl = await uploadToStorage(
        videoPath,

        `${jobId}.webm`,

        "video/webm",
      );

      console.log("VIDEO UPLOADED");
    }

    /*
      notify manager passed
    */

    await sendStatusUpdate(
      jobId,

      "passed",

      screenshotUrl,

      videoUrl,
    );

    console.log("TEST PASSED");

    console.log(executionLogs);
  } catch (error: any) {
    console.error("PLAYWRIGHT ERROR:", error);

    /*
      notify manager failed
    */

    await sendStatusUpdate(
      jobId,

      "failed",

      undefined,

      undefined,

      error.message,
    );

    /*
      rethrow for BullMQ
    */

    throw error;
  } finally {
    /*
      close browser safely
    */

    if (browser) {
      await browser.close();

      console.log("BROWSER CLOSED");
    }
  }
}
