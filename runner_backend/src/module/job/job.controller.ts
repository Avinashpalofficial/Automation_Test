import { submitJobService } from "./job_service";
import { Request, Response } from "express";

export async function submitJobController(req: Request, res: Response) {
  try {
    const idempotencyKey = req.headers["idempotency-key"];

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "Idempotency-Key is required",
      });
    }
    const result = await submitJobService({
      payload: req.body,
      idempotencyKey: String(idempotencyKey),
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit job",
    });
  }
}
