/**
 * Where a certificate really is, once the office's unsent steps are counted.
 *
 * A certificate that already exists on the server can still be printed,
 * photographed and handed over with no line. Those steps wait in the queue,
 * but the list is drawn from the last copy the server sent — which still says
 * "Processing". So the clerk pressed Print, answered "yes, it printed", and
 * the row went on saying Processing: no Release button, and nothing on screen
 * to show the print had registered at all.
 *
 * Each waiting step is laid over its row, oldest first, so the row shows the
 * certificate's actual stage and offers the buttons that stage allows.
 *
 * Pure — no storage, no network — so the rule can be tested for what it is.
 */

export interface StepJob {
  path: string;
  body: unknown;
  createdAt: number;
  status: string;
}

export interface StepRow {
  id: number;
  status: string;
  photo_url?: string | null;
  printed_at?: string | null;
  released_at?: string | null;
  _pendingSync?: boolean;
}

export function applyPendingSteps<T extends StepRow>(rows: T[], jobs: StepJob[]): T[] {
  /* A refused step did not happen and must not be shown as if it had. */
  const live = jobs
    .filter((job) => job.status !== "failed")
    .sort((a, b) => a.createdAt - b.createdAt);

  if (live.length === 0) {
    return rows;
  }

  return rows.map((row) => {
    /* A certificate still being created is shown from its own job instead. */
    if (row.id <= 0) {
      return row;
    }

    const prefix = `/certificates/${row.id}/`;
    let next: T = row;
    let touched = false;

    for (const job of live) {
      if (!job.path.startsWith(prefix)) {
        continue;
      }

      const step = job.path.slice(prefix.length);
      const at = new Date(job.createdAt).toISOString();

      if (step === "photo-data") {
        const photo = (job.body as { photo_data?: string } | null)?.photo_data;

        next = { ...next, photo_url: photo ?? next.photo_url };
      } else if (step === "accept") {
        next = { ...next, status: "Processing" };
      } else if (step === "mark-printed") {
        next = { ...next, status: "Ready to Claim", printed_at: at };
      } else if (step === "release") {
        next = { ...next, status: "Released", released_at: at };
      } else {
        continue;
      }

      touched = true;
    }

    return touched ? { ...next, _pendingSync: true } : row;
  });
}
