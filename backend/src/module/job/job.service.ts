import { supabase } from "../../config/supabase";
interface UpdateJobStatusInput {
  job_id: string;
  last_known_status: string;
}

export async function updateJobStatusService({
  job_id,
  last_known_status,
}: UpdateJobStatusInput) {
  /*
    update job_refs
  */

  const { error } = await supabase
    .from("job_refs")
    .update({
      last_known_status: last_known_status,

      /*
        optional artifact
      */
    })
    .eq("job_id", job_id);

  if (error) {
    throw new Error(error.message);
  }
}
