import { supabase } from "../../config/supabase";
import { generateWorkspaceId } from "../../utils/generate-id";
interface CreateWorkspaceServiceInput {
  name: string;
  createdBy: string;
}
/* create workspace  */
export async function createWorkspaceService({
  name,
  createdBy,
}: CreateWorkspaceServiceInput) {
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

/*  Get Workspace*/
