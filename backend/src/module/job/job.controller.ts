import { Request, Response } from "express";
import { updateJobStatusService } from "./job.service";
export async function updateJobStatusController(req: Request, res: Response) {
  try {
    const { job_id, last_known_status } = req.body;

    /*
      validation
    */
    console.log("BODY:", req.body);

    console.log("JOB ID:", job_id);

    console.log("STATUS:", last_known_status);
    if (!job_id || !last_known_status) {
      return res.status(400).json({
        success: false,
        message: "jobId and status are required",
      });
    }

    /*
      service call
    */

    await updateJobStatusService({
      job_id,
      last_known_status,
    });
    console.log("update");

    return res.status(200).json({
      success: true,
      message: "Job status updated",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update job status",
    });
  }
}
