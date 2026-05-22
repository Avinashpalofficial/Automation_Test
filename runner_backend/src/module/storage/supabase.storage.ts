import fs from "fs";

import { runnerSupabaseClient } from "../../config/supabase";

export async function uploadToStorage(
  filePath: string,
  key: string,
  contentType: string,
) {
  const fileContent = fs.readFileSync(filePath);

  const { data, error } = await runnerSupabaseClient.storage
    .from("artifacts")
    .upload(key, fileContent, {
      contentType,
      upsert: true,
    });

  console.log("UPLOAD DATA:", data);

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = runnerSupabaseClient.storage
    .from("artifacts")
    .getPublicUrl(key);

  return publicUrlData.publicUrl;
}
