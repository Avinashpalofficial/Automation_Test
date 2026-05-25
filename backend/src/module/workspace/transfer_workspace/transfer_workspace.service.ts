import { supabase } from "../../../config/supabase";
import { checkOwnership } from "../../../permission/check_owner";
import { checkWorkspaceExist } from "../../../permission/check_workspace";
import { ErrorHandler } from "../../../utils/ApiError";

interface tranferWorkspaceServiceInput {
  workspaceId: string;
  currentOwnerId: string;
  targetUserId: string;
}
export async function transferWorkspaceService({
  workspaceId,
  currentOwnerId,
  targetUserId,
}: tranferWorkspaceServiceInput) {
  /**Prevent self Transfer */
  if (currentOwnerId == targetUserId) {
    throw new ErrorHandler("You already own this workspace", 400);
  }
  /** check Workspace */
  await checkWorkspaceExist({
    workspaceId,
  });
  /**check current owner */
  await checkOwnership({
    workspaceId,
    currentOwnerId,
  });

  /**verify targetuser exists in workspace */
  const { data: targetMembership, error: targetError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .single();
  if (!targetMembership || targetError) {
    throw new ErrorHandler("Target user is not a workspace member", 404);
  }
  /**transer owner ship */

  const { error: downGradeError } = await supabase
    .from("workspace_members")
    .update({ role: "admin" })
    .eq("workspace_id", workspaceId)
    .eq("user_id", currentOwnerId);
  if (downGradeError) {
    console.error("TRANSFER WORKSPACE DOWNGRADE ERROR:", downGradeError);

    throw new ErrorHandler("Failed to downgrade current owner", 500);
  }

  const { error: promoteError } = await supabase
    .from("workspace_members")
    .update({
      role: "owner",
    })
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);
  if (promoteError) {
    console.error("TRANSFER WORKSPACE PROMOTE ERROR:", promoteError);

    /**role back */
    await supabase
      .from("workspace_members")
      .update({
        role: "owner",
      })
      .eq("workspace_id", workspaceId)
      .eq("user_id", currentOwnerId);
    throw new ErrorHandler("Failed to transfer workspace ownership", 500);
  }
  return {
    success: true,
    message: "Workspace ownership transferred successfully",
  };
}
