import { ZodSchema } from "zod/v3";
import { Request, Response, NextFunction } from "express";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ mesg: "Validation error", errors: result.error.errors });
    }
    next();
  };
}
