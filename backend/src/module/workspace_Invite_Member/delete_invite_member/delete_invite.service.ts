import { supabase } from "../../../config/supabase";
import { ErrorHandler } from "../../../utils/ApiError";

interface deleteInviteMemberInput {
  workspaceId: string;
  inviteId: string;
  userId: string;
}

export async function deleteInviteMemberService({
  workspaceId,
  inviteId,
  userId,
}: deleteInviteMemberInput) {
  /**check the workspace membership */

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  console.log(membership);
  console.log("userId:", userId);
  if (!membership || membershipError) {
    throw new ErrorHandler("You are not a member of this workspace", 403);
  }
  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new ErrorHandler("Only admin  and owner can delete the invites", 403);
  }

  /**check the invite exists */
  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .select("id")
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId)
    .single();
  console.log("inviteId:", invite);

  if (!invite || inviteError) {
    throw new ErrorHandler("Invite not found", 404);
  }
  /**Delete Invite */
  const { error: deleteError } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId);
  if (deleteError) {
    throw new ErrorHandler("Failed to delete invite", 500);
  }

  return true;
}
