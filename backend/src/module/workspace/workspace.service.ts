import { supabase } from "../../config/supabase";
import { generateWorkspaceId } from "../../utils/generate-id";
interface CreateWorkspaceServiceInput {
  name: string;
  createdBy: string;
}
export async function createWorkspaceService({
  name,
  createdBy,
}: CreateWorkspaceServiceInput) {
  // validation
  if (!name || !name.trim()) {
    throw new Error("Workspace name is required");
  }

  if (name.length < 3) {
    throw new Error("Workspace name must be at least 3 characters");
  }

  const workspaceId = generateWorkspaceId();

  // insert workspace
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      id: workspaceId,
      name: name.trim(),
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error("WORKSPACE CREATE ERROR:", error);

    throw new Error(error.message);
  }

  return data;
}
