import { id } from "zod/locales";
import { supabase } from "../../config/supabase";
import { generateSuiteId } from "../../utils/generate-id";

interface CreateSuiteInput {
  workspaceId: string;
  name: string;
  description?: string;
  repo?: string;
  createdBy: string;
}
export async function createSuiteService({
  workspaceId,
  name,
  description,
  repo,
  createdBy,
}: CreateSuiteInput) {
  /** check membership */
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", createdBy)
    .maybeSingle();
  if (membershipError || !membership) {
    console.error("Membership check error:", membershipError);
    throw new Error("Access denied");
  }
  /** insert suite */
  const { data: suite, error: suiteError } = await supabase
    .from("suites")
    .insert({
      id: generateSuiteId(),
      workspace_id: workspaceId,
      name,
      description,
      repo,
      created_by: createdBy,
    })
    .maybeSingle();
  if (suiteError) {
    console.error("Error creating suite:", suiteError);
    throw new Error("Failed to create suite");
  }
  return suite;
}
