import { object } from "zod";
import { supabase } from "../../../config/supabase";
import { ErrorHandler } from "../../../utils/ApiError";

interface updateWorkspaceInput {
  workspaceId: string;
  userId: string;
  name?: string;
  repo?: string;
}

export async function updateWorksapceService({
  workspaceId,
  userId,
  name,
  repo,
}: updateWorkspaceInput) {
  /**check user is admin or not */
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (!membership || membershipError) {
    throw new ErrorHandler("Access denined", 403);
  }
  if (membership.role !== "admin") {
    throw new ErrorHandler("Only workspace admins can update workspace", 403);
  }

  /**Build update payload dynamically */
  const updateData: Record<string, string> = {};

  if (name !== undefined) {
    updateData.name = name;
  }
  if (repo !== undefined) {
    updateData.repo = repo;
  }

  /**update Data */
  const { data: updatedWorkspace, error: updateError } = await supabase
    .from("workspaces")
    .update(updateData)
    .eq("id", workspaceId)
    .select()
    .single();

  if (updateError) {
    console.error("UPDATE WORKSPACE SERVICE ERROR", updateError);

    throw new ErrorHandler("Failed to update workspace", 500);
  }

  return updatedWorkspace;
}
