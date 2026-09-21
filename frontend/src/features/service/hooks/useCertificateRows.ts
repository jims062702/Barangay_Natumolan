import { useState, useEffect } from "react";
import { useAuth } from "../../../shared/auth/AuthContext";
import { cachedResident } from "../../../shared/offline/residentCache";
import { allJobs, pendingFor } from "../../../shared/offline/writeQueue";
import { setMeta } from "../../../shared/offline/offlineDb";
import { cachedOnly, cachedGet } from "../../../shared/offline/referenceCache";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import type { Certificate } from "../../../shared/types";
import { applyPendingSteps, type StepRow } from "../lib/pendingSteps";
import { serviceApi } from "../api";
import { syncNumberSeries } from "../lib/certificateNumbers";
import type { Catalogue } from "../types";
import type { CouncilMember } from "../lib/certificate/types";

/**
 * The counter list: its rows, the catalogue and council it prints with, and keeping it fresh.
 */
export function useCertificateRows() {
  /* Whoever is at the counter: with no line they ARE the one who started it. */
  const { user } = useAuth();

  const [rows, setRows] = useState<Certificate[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  /*
   * How many sit under each chip. Of the whole list rather than the page,
   * and unmoved by which chip is picked — otherwise the chosen one would
   * read its total and every other would read zero, which is exactly the
   * question the chips are there to answer.
   */
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
 // "" = walk-in
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  /* The council that signs the paper, read from the Officials roster. */
  const [council, setCouncil] = useState<CouncilMember[]>([]);
  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  /**
   * Certificates the office has filed but the server has not seen yet.
   *
   * Rendered from the queue itself, with a made-up id and no certificate
   * number — because there is no number yet; the server mints it, and
   * inventing one here would put a number on screen that the paper will
   * never carry.
   *
   * This exists because of what happened without it: the clerk filed a
   * certificate offline, was told it was recorded, opened this very list,
   * and found "No records found." Nothing had gone wrong and every signal
   * on the screen said it had.
   */
  const queuedRows = async (
    jobs: { id: string; body: unknown; createdAt: number }[],
  ): Promise<Certificate[]> =>
    Promise.all(
      jobs.map(async (job, index) => {
        const body = job.body as {
          resident_id: number;
          certificate_type: string;
          purpose?: string | null;
          fee_amount: number;
          certificate_number?: string;
          reference_number?: string;
          template_fields?: Record<string, string>;
          is_exempt?: boolean;
          offline_status?: string;
          photo_data?: string;
          printed_at?: string;
          released_at?: string;
        };

        /* The name comes from the device's own copy of the register — the
           job body carries only an id, because that is all the server
           needs and nothing extra should ride along to it. */
        const resident = await cachedResident(body.resident_id);

        return {
          /* Negative, so it can never collide with a real row's id. */
          id: -(index + 1),
          /*
           * The number minted on this device when it was filed — the same
           * one that is sent to the server and printed on the paper. Falls
           * to a dash only for a job queued before numbering existed.
           */
          certificate_number: body.certificate_number ?? "—",
          reference_number: body.reference_number ?? "",
          template_fields: body.template_fields ?? {},
          is_exempt: body.is_exempt ?? false,
          /* Which queued job this row IS, so printing and handing it over can
             move that job on instead of calling a server that has no record. */
          _jobId: job.id,
          /* The photo taken at the counter, shown and printed straight from
             the device. */
          photo_url: body.photo_data ?? null,
          /* Set once printed, which is what locks the photograph — the paper
             and the record have to agree, offline as much as online. */
          printed_at: body.printed_at ?? null,
          released_at: body.released_at ?? null,
          certificate_type: body.certificate_type,
          purpose: body.purpose ?? null,
          /*
           * Started by the clerk who filed it, at the moment they did.
           *
           * The server records exactly this when the job is sent — the
           * token it is sent with is theirs — so the detail said "Not
           * started yet" about work the clerk had just done, and then
           * filled itself in hours later when the line came back.
           */
          processor: user ? { id: user.id, name: user.name } : null,
          processed_at: new Date(job.createdAt).toISOString(),
          fee_amount: body.fee_amount,
          /* The server sets the stamp when the job arrives; shown here the same
             way so the amount a clerk quotes offline is the amount recorded. */
          documentary_stamp: catalogue?.documentary_stamp ?? 0,
          /*
           * The certificate's REAL status, not "waiting to be sent".
           *
           * That label replaced the status outright, and the whole workflow
           * keys off status — Print shows only for Processing, Release only
           * for Ready to Claim. A queued certificate matched none of them, so
           * it had no buttons at all: the clerk could file offline and then
           * not print, which is the one thing a walk-in came for.
           *
           * Whether it has reached the server is a separate fact, shown
           * beside the status rather than instead of it.
           */
          status: body.offline_status ?? "Processing",
          created_at: new Date(job.createdAt).toISOString(),
          resident,
        } as unknown as Certificate;
      }),
    );
  /**
   * What the office has done to certificates that the server does not know yet.
   *
   * A certificate that already exists on the server can still be printed,
   * photographed and handed over with no line. Those steps sit in the queue —
   * but the list is drawn from the last copy the server sent, which still
   * says "Processing". So the clerk pressed Print, answered yes, and the row
   * went on saying Processing: no Release button, and no sign anything had
   * happened.
   *
   * Each waiting step is laid over its row here, in the order it was done, so
   * the row shows where the certificate actually is.
   */
  const withPendingSteps = async (rows: Certificate[]): Promise<Certificate[]> =>
    /* The rule lives in ../lib/pendingSteps, where it is tested. */
    applyPendingSteps(rows as unknown as StepRow[], await allJobs()) as unknown as Certificate[];
  const load = (silent = false) => {
    if (!silent) setLoading(true);

    serviceApi.certificates({ params: { page, status: statusFilter || undefined } })
      .then((r) => {
        const fetched = (r.data.data.data ?? []) as Certificate[];

        /* The server's copy, with anything still queued laid over it — the
           line can be back before the queue has finished sending. */
        void withPendingSteps(fetched).then(setRows);
        setCounts(r.data.data.counts ?? {});
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);

        /* Kept so the same list can be shown with no line. Only the first
           page: it is what the counter looks at, and the rest is history. */
        if (page === 1 && !statusFilter) {
          void setMeta("ref.certificates-page1", fetched);
        }
      })
      .catch(async (err) => {
        /*
         * A refusal is the server talking and belongs on screen as itself.
         * A request that never arrived is the line being down, and the
         * answer to that is the copy on the device — not an empty table.
         */
        if (err?.response) {
          return;
        }

        const cached = await cachedOnly<Certificate[]>("certificates-page1");
        /* Newest first, like the server's list — the queue keeps them in
           the order they were filed, which put the latest at the bottom. */
        const waiting = (await queuedRows(await pendingFor("/certificates"))).sort(
          (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
        );

        const held = [...waiting, ...(await withPendingSteps(cached ?? []))];

        /*
         * The chips have to work with no line as well.
         *
         * Counting and filtering are the server's job online, and offline
         * they were nobody's: every chip read blank and pressing one left
         * the same rows on screen, Released ones included. A clerk pressing
         * "Ready to Claim" and being handed the whole list learns not to
         * trust the chips at all — and the counter list is exactly where
         * status has to be read at a glance.
         *
         * Counted across everything the device holds, never the filtered
         * view, so the numbers stay put as the chips are pressed.
         */
        const offlineCounts: Record<string, number> = {};
        for (const row of held) {
          offlineCounts[row.status] = (offlineCounts[row.status] ?? 0) + 1;
        }

        const shown = statusFilter ? held.filter((row) => row.status === statusFilter) : held;

        setRows(shown);
        setCounts(offlineCounts);
        setTotal(shown.length);
        setLastPage(1);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);
  // Live updates: new online requests appear without a manual refresh.
  useAutoRefresh(() => load(true), REFRESH.staff);
  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("certificates", () => load(true));
  /*
   * Both fetched once, not per print. A clerk printing a stack of twenty
   * should not ask the server twenty times for a fee schedule that changes
   * when an ordinance does.
   */
  useEffect(() => {
    /*
     * Through the cache, so the form still works with no line.
     *
     * This is the ordinance's fee schedule and the list of certificate
     * types. Fetched straight from the server, it came back empty offline
     * and the "Certificate type" dropdown had nothing in it — the clerk
     * had the resident, the purpose and the fee, and could not choose what
     * to issue. It is settings, not records; a copy on the device is never
     * meaningfully stale.
     */
    /* The office's number series, so a certificate filed later with no
       line can still carry a real number. */
    void syncNumberSeries();

    cachedGet<Catalogue>("/certificates/fee-schedule", "fee-schedule")
      .then((data) => setCatalogue(data))
      .catch(() => setCatalogue(null));
    /*
     * The public roster, which returns { barangay, sk } already grouped —
     * and which every signed-in office may read. The SK chairperson is
     * folded in because the clearance sidebar lists them with the council.
     */
    /*
     * Cached too, and for a sharper reason than the fee schedule.
     *
     * These names are PRINTED — the council sidebar down the left of every
     * Barangay Clearance, and the Punong Barangay's name under the
     * signature line. With no line this came back empty and the certificate
     * printed with a blank sidebar and no name to sign under: a document
     * the barangay could not hand over. The roster changes at an election.
     */
    cachedGet<{ barangay?: CouncilMember[]; sk?: CouncilMember[] }>("/officials", "officials")
      .then((data) => setCouncil([...(data?.barangay ?? []), ...(data?.sk ?? [])]))
      .catch(() => setCouncil([]));
  }, []);

  return {
    rows, setRows, statusFilter, setStatusFilter, page, setPage, lastPage, setLastPage, total,
    setTotal, counts, setCounts, loading, setLoading, catalogue, setCatalogue, council,
    setCouncil, queuedRows, withPendingSteps, load,
  };
}

export type CertificateRowsState = ReturnType<typeof useCertificateRows>;
