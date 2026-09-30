import { FiPlus } from "react-icons/fi";
import PageHeader from "../../../shared/ui/PageHeader";
import { STATUSES } from "../lib/postDesk";
import { usePostDesk } from "../hooks/usePostDesk";
import { PostTable } from "../components/PostTable";
import { PostEditor } from "../components/PostEditor";
import { PageLoading } from "../../../shared/ui/PageLoad";

export default function Announcements() {
  const ctx = usePostDesk();
  const {
    counts, statusFilter, setStatusFilter, setPage, openAdd,
  } = ctx;

  if (ctx.pageLoad.state !== "ready") return <PageLoading load={ctx.pageLoad} onRetry={() => ctx.load()} />;

  return (
    <div>
      <PageHeader
        title="News & Announcements"
        subtitle="Announcements · Events · Activities · Advisories · Programs"
        actions={
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> New post
          </button>
        }
      />

      {/* Draft / Published / Archived, with how many are in each. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ label: "All posts", value: "" }, ...STATUSES.map((s) => ({ label: s, value: s }))].map(
          (chip) => (
            <button
              key={chip.value || "all"}
              type="button"
              onClick={() => {
                setStatusFilter(chip.value);
                setPage(1);
              }}
              aria-pressed={statusFilter === chip.value}
              className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                statusFilter === chip.value
                  ? "bg-primary text-white"
                  : "bg-secondary text-dark hover:bg-primary/10"
              }`}
            >
              {chip.label}
              <span className="ml-1.5 opacity-70">
                {chip.value
                  ? (counts[chip.value] ?? 0)
                  : Object.values(counts).reduce((sum, n) => sum + n, 0)}
              </span>
            </button>
          )
        )}
      </div>

      <PostTable ctx={ctx} />

      <PostEditor ctx={ctx} />
    </div>
  );
}

