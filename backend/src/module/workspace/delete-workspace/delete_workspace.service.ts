import { supabase } from "../../../config/supabase";
import { ErrorHandler } from "../../../utils/ApiError";

interface deleteWorkspaceInput {
  workspaceId: string;
  userId: string;
  confirmName: string;
}

export async function deleteWorkspaceService({
  workspaceId,
  userId,
  confirmName,
}: deleteWorkspaceInput) {
  /** Get workspace and memberInfo */
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select(
      `
      role,
      workspace:workspaces (
        id,
        name
      )
      `,
    )
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    throw new ErrorHandler("Access denied", 403);
  }

  /** only owner access */
  if (membership.role !== "owner") {
    throw new ErrorHandler("Only workspace owner can delete workspace", 403);
  }

  /**Confirm workspace name */
  const workspace = Array.isArray(membership.workspace)
    ? membership.workspace[0]
    : membership.workspace;

  if (!workspace) {
    throw new ErrorHandler("Workspace not found", 404);
  }

  if (workspace.name !== confirmName.trim()) {
    throw new ErrorHandler(
      "Confirmation name does not match workspace name",
      404,
    );
  }
  /** Delete dependent data first */
  const { error: memberDeleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId);

  if (memberDeleteError) {
    console.error("DELETE MEMBERS ERROR", memberDeleteError);
    throw new ErrorHandler("Failed to delete workspace members", 500);
  }
  const { error: workspaceDeleteError } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);

  if (workspaceDeleteError) {
    console.error("DELETE WORKSPACE ERROR", workspaceDeleteError);

    throw new ErrorHandler("Failed to delete workspace", 500);
  }

  return {
    deleted: true,
    workspaceId,
  };
}
