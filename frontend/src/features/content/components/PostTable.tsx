import { FiImage, FiUser, FiArrowUp, FiArrowDown, FiEdit2, FiTrash2 } from "react-icons/fi";
import Card from "../../../shared/ui/Card";
import DataTable from "../../../shared/ui/DataTable";
import StatusBadge from "../../../shared/ui/StatusBadge";
import RowAction, { RowActions } from "../../../shared/ui/RowAction";
import { KIND, kindOf, whenOf } from "../lib/postKinds";
import type { PostDeskState } from "../hooks/usePostDesk";
import type { Announcement } from "../types";

/**
 * Every post, with its status and order on the landing page.
 */
export function PostTable({ ctx }: { ctx: PostDeskState }) {
  const { rows, move, openEdit, remove, total, loading, page, lastPage, setPage } = ctx;

  return (
    <Card>
      <DataTable
        columns={[
          {
            header: "Post",
            render: (a: Announcement) => (
              <div className="flex items-start gap-3">
                {/*
                  A fixed frame, and the photo cropped into it. A post
                  without one gets the placeholder rather than a hole, so
                  every row is the same height and the eye can run down the
                  titles instead of stepping over gaps.
                */}
                <span className="relative block h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  {a.image_url ? (
                    <img src={a.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-gray-300">
                      <FiImage className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                </span>

                <span className="min-w-0">
                  <span className="block font-semibold leading-snug text-dark">{a.title}</span>

                  {/*
                    The line under the title is what the card will show. It
                    is here so the office can see, without opening
                    anything, which posts are going out with a summary
                    lifted from the middle of a sentence.
                  */}
                  {(a.excerpt || a.body) && (
                    <span className="mt-0.5 line-clamp-1 block text-xs text-gray-500">
                      {a.excerpt || a.body}
                    </span>
                  )}

                  {(a.byline || a.author_name) && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400">
                      <FiUser className="h-3 w-3" aria-hidden="true" />
                      {a.byline || a.author_name}
                    </span>
                  )}
                </span>
              </div>
            ),
          },
          {
            header: "Kind",
            render: (a: Announcement) => (
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                  KIND[kindOf(a.category)].tone
                }`}
              >
                {kindOf(a.category)}
              </span>
            ),
          },
          { header: "Status", render: (a: Announcement) => <StatusBadge status={a.status} /> },
          {
            header: "When",
            /*
              A date on its own says nothing here: the same column holds an
              event that has not happened, an activity that has, and the day
              a notice went out. So the row says WHICH date it is.
            */
            render: (a: Announcement) => {
              const when = whenOf(a);
              if (!when) return <span className="text-gray-400">—</span>;

              const kind = kindOf(a.category);
              const label =
                kind === "Event"
                  ? "Happens"
                  : kind === "Activity"
                    ? "Completed"
                    : kind === "Advisory"
                      ? "In effect"
                      : "Posted";

              return (
                <span className="block">
                  <span className="block text-[11px] uppercase tracking-wide text-gray-400">
                    {label}
                  </span>
                  <span className="block text-sm text-dark">{when}</span>
                </span>
              );
            },
          },
          {
            header: "Order",
            render: (a: Announcement) => {
              const index = rows.findIndex((r) => r.id === a.id);

              /* The same round icon buttons every other table uses, rather
                 than two little bordered squares of their own design. */
              return (
                <RowActions>
                  <RowAction
                    label="Show earlier"
                    icon={FiArrowUp}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  />
                  <RowAction
                    label="Show later"
                    icon={FiArrowDown}
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                  />
                </RowActions>
              );
            },
          },
          {
            header: "Actions",
            render: (a: Announcement) => (
              <RowActions>
                <RowAction label="Edit post" icon={FiEdit2} onClick={() => openEdit(a)} />
                <RowAction label="Delete post" icon={FiTrash2} tone="danger" onClick={() => remove(a)} />
              </RowActions>
            ),
          },
        ]}
        rows={rows}
        rowKey={(a) => a.id}
        numbered
        total={total}
        searchable
        searchPlaceholder="Search by Title, Author, Category or Text…"
        getSearchText={(a) =>
          `${a.title} ${a.category} ${a.status} ${a.byline ?? a.author_name ?? ""} ${a.excerpt ?? ""} ${a.body ?? ""}`
        }
        filters={[{ label: "Kind", getValue: (a) => kindOf(a.category) }]}
        loading={loading}
        page={page}
        lastPage={lastPage}
        onPageChange={setPage}
      />
    </Card>
  );
}
