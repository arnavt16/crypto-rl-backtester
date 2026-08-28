import type {
  BaselineResponse,
  JobResult,
  JobStatus,
  MetaResponse,
  TrainParams,
} from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => request<MetaResponse>("/api/meta"),
  baseline: () => request<BaselineResponse>("/api/baseline"),
  startTrain: (params: TrainParams) =>
    request<{ job_id: string }>("/api/train", {
      method: "POST",
      body: JSON.stringify(params),
    }),
  jobStatus: (jobId: string) => request<JobStatus>(`/api/jobs/${jobId}`),
  jobResults: (jobId: string) => request<JobResult>(`/api/jobs/${jobId}/results`),
};

/** Poll a job until it's done or errored. Calls onProgress as status updates. */
export async function pollJob(
  jobId: string,
  onProgress: (status: JobStatus) => void,
  intervalMs = 900
): Promise<JobResult> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await api.jobStatus(jobId);
    onProgress(status);
    if (status.status === "done") {
      return api.jobResults(jobId);
    }
    if (status.status === "error") {
      throw new Error(status.error ?? "training job failed");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
