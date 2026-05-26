import { supabase } from "../../../config/supabase";
import { checkMembership } from "../../../permission/check_membership";
import { checkWorkspaceExist } from "../../../permission/check_workspace";
import { ErrorHandler } from "../../../utils/ApiError";

interface updateMemberRoleInput {
  workspaceId: string;
  targetUserId: string;
  userId: string;
}

export async function updateMemberRoleService({
  workspaceId,
  targetUserId,
  userId,
}: updateMemberRoleInput) {
  /**check workspace exists or not */
  await checkWorkspaceExist({ workspaceId });
  /**check membership */
  await checkMembership({
    workspaceId,
    userId,
  });
  /** check member exist or not */
  const { data: memberData, error: memberError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .single();

  if (!memberData || memberError) {
    throw new ErrorHandler("member not found in workspace", 404);
  }

  if (memberData.role === "owner") {
    throw new ErrorHandler("Owner role cannot be modified", 403);
  }
}
/**this logic is incomplete */
