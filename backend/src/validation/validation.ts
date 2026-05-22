import { z } from "zod";

export const signupSchema = z.object({
  name: z
    .string()
    .min(4, "Name must be at least 4 characters long")
    .max(20, "Name must be at most 20 characters long"),

  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(20, "Password must be at most 20 characters long"),
});
