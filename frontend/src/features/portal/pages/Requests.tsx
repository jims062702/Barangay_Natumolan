import { FiPlus } from "react-icons/fi";
import PageHeader from "../../../shared/ui/PageHeader";
import { usePortalRequests } from "../hooks/usePortalRequests";
import { RequestTable } from "../components/requests/RequestTable";
import { NewRequestModal } from "../components/requests/NewRequestModal";
import { PageLoading } from "../../../shared/ui/PageLoad";

/**
 * Everything the resident has asked the barangay for — one list.
 *
 * This used to be two pages. "My Requests" showed the request and "My
 * Certificates" showed the document that came out of it: the same event,
 * listed twice, under two different reference numbers. Worse, the two
 * disagreed — a certificate the clerk had marked READY TO CLAIM was still
 * shown as "In Progress" on the requests page, because that page read the
 * request's status while the counter had moved the certificate's.
 *
 * A resident cannot reconcile two screens. So there is one, and where a
 * request has produced a document, the DOCUMENT's status is what it says —
 * that is the record that knows whether the paper exists.
 */

export default function Requests() {
  const ctx = usePortalRequests();
  const {
    openCreate,
  } = ctx;

  if (ctx.pageLoad.state !== "ready") return <PageLoading load={ctx.pageLoad} onRetry={() => ctx.load()} />;

  return (
    <div>
      <PageHeader
        title="My Requests & Certificates"
        subtitle="Everything you have asked the barangay for, and where each one has got to"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Request certificates
          </button>
        }
      />

      <RequestTable ctx={ctx} />

      <NewRequestModal ctx={ctx} />
    </div>
  );
}

