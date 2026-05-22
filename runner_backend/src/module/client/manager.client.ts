import axios from "axios";

export async function sendStatusUpdate(
  job_id: string,
  last_known_status: string,
  artifactUrl?: string,
  screenshotUrl?: string,
  videoUrl?: string,
) {
  console.log("SENDING WEBHOOK...");
  const response = await axios.post(
    "http://localhost:3000/internal/jobs/status",
    {
      job_id,
      last_known_status,
      artifactUrl,
      screenshotUrl,
      videoUrl,
    },
  );
  console.log("WEBHOOK RESPONSE:", response.data);
}
