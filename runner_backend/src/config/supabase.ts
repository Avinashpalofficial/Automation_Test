import { createClient } from "@supabase/supabase-js";

export const runnerSupabaseClient = createClient(
  process.env.RUNNER_SUPABASE_URL!,
  process.env.RUNNER_SUPABASE_ANON_KEY!,
);
