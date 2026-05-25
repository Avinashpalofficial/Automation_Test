import { da } from "zod/locales";
import { supabase } from "../../../config/supabase";

interface workspaceDetailInput {
  workspaceId: string;
  userId: string;
}
/** List of memberships. */

export async function getWorkspacesService(userId: string) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      `
      role,
      workspace:workspaces (
        id,
        name,
        created_at
      )
    `,
    )
    .eq("user_id", userId);

  if (error) {
    console.error("GET WORKSPACES ERROR:", error);

    throw new Error(error.message);
  }

  return data;
}

/** Workspace details */

export async function getWorkspaceDetailService({
  workspaceId,
  userId,
}: workspaceDetailInput) {
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)

    .single();
  if (!membership || membershipError) {
    console.log("membership:", membership);
    console.log("membershipError:", membershipError);
    throw new Error("Unauthorized access to workspace");
  }

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();
  if (error) {
    console.error("GET WORKSPACE ERROR:", error);

    throw new Error(error.message);
  }
  return data;
}
