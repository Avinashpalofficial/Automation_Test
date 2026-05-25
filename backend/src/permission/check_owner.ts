import { supabase } from "../config/supabase";
import { ErrorHandler } from "../utils/ApiError";

interface checkOwnershipInput {
  workspaceId: string;
  currentOwnerId: string;
}

export async function checkOwnership({
  workspaceId,
  currentOwnerId,
}: checkOwnershipInput) {
  const { data: checkOwnerMembership, error: currentOwnerError } =
    await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", currentOwnerId)
      .single();
  if (!checkOwnerMembership || currentOwnerError) {
    throw new ErrorHandler("You are not a member of this workspace", 403);
  }
  if (checkOwnerMembership.role !== "owner") {
    throw new ErrorHandler("Only workspace owner can transfer ownership", 403);
  }
  return checkOwnerMembership;
}
