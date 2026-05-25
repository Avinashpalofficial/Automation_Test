import { supabase } from "../config/supabase";
import { ErrorHandler } from "../utils/ApiError";

interface CheckWorkspaceExistsInput {
  workspaceId: string;
}
export async function checkWorkspaceExist({
  workspaceId,
}: CheckWorkspaceExistsInput) {
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .single();
  if (!workspace || workspaceError) {
    throw new ErrorHandler("Workspace not found", 404);
  }
  return workspace;
}
