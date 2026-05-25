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

export const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name is required")
    .min(3, "Workspace name must be at least 3 characters"),
});

export const updateWorkspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Workspace name must be at least 3 characters")
      .max(50, "Workspace name cannot exceed 50 characters")
      .optional(),

    repo: z.string().trim().url("Repo must be a valid URL").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

/** Delete Workspace zod schema */

export const deleteWorkspaceSchema = z.object({
  confirmName: z
    .string()
    .trim()
    .min(1, "Workspace confirmation name is required"),
});

/**Transfer Ownership */

export const transferWorkspaceSchema = z.object({
  targetUserId: z.string().uuid("Invalid target user id"),

  confirm: z.literal("TRANSFER", {
    message: "Type must be TRANSFER",
  }),
});
