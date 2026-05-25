import { supabase } from "../config/supabase";
import { ErrorHandler } from "../utils/ApiError";

interface checkMembershipInput {
  workspaceId: string;
  userId: string;
}

export async function checkMembership({
  workspaceId,
  userId,
}: checkMembershipInput) {
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
}
