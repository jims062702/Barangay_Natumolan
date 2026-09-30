import { useState, useMemo, useEffect, type FormEvent } from "react";
import { useAuth } from "../../../shared/auth/AuthContext";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { useUpload } from "../../../shared/hooks/useUpload";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { bylineFor, STATUSES, asDateInput } from "../lib/postDesk";
import { type PostKind, kindOf, KIND_FIELDS } from "../lib/postKinds";
import { contentApi } from "../api";
import type { Announcement } from "../types";
import { usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * The state and handlers of <Announcements>, so its sections can share them.
 */
export function usePostDesk() {
  const { user } = useAuth();

  const [rows, setRows] = useState<Announcement[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* The page's skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  // null = creating a new post; an id = correcting an existing one.
  const [editId, setEditId] = useState<number | null>(null);

  /* One object rather than eighteen useStates: the fields a post carries
     depend on its kind, and they are set and cleared together. */
  const blank = useMemo(
    () => ({
      title: "",
      body: "",
      excerpt: "",
      author_name: bylineFor(user?.office, user?.role),
      category: "Announcement" as PostKind,
      status: "Published" as (typeof STATUSES)[number],
      location: "",
      event_at: "",
      event_time: "",
      organizer: "",
      contact_info: "",
      registration_deadline: "",
      completed_at: "",
      participants: "",
      effective_at: "",
      expires_at: "",
      urgency: "",
    }),
    [user]
  );

  const [form, setForm] = useState(blank);
  const [image, setImage] = useState<File | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  /* The post as the editor opened on it: blank for a new one. */
  const [original, setOriginal] = useState(blank);

  const set = (key: keyof typeof blank, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const kind = kindOf(form.category);
  const uses = (field: string) => KIND_FIELDS[kind].includes(field);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    contentApi.posts({ params: { page, status: statusFilter || undefined } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
        setCounts(r.data.data.status_counts ?? {});
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // Live updates without a manual refresh.
  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("announcements", () => load(true));

  /* Progress for the photo, so a slow upload is not mistaken for a dead one. */
  const upload = useUpload();

  /* Fields are filled in when the dialog OPENS, so a half-typed post never
     leaks into the next one after closing. */
  const openAdd = () => {
    setEditId(null);
    setForm(blank);
    setOriginal(blank);
    setImage(null);
    setCurrentImage(null);
    setOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditId(a.id);
    const fields: typeof blank = {
      title: a.title,
      body: a.body ?? "",
      excerpt: a.excerpt ?? "",
      author_name: a.author_name ?? "",
      category: kindOf(a.category),
      status: (a.status ?? "Published") as (typeof STATUSES)[number],
      location: a.location ?? "",
      event_at: asDateInput(a.event_at),
      event_time: a.event_time ?? "",
      organizer: a.organizer ?? "",
      contact_info: a.contact_info ?? "",
      registration_deadline: asDateInput(a.registration_deadline),
      completed_at: asDateInput(a.completed_at),
      participants: a.participants ?? "",
      effective_at: asDateInput(a.effective_at),
      expires_at: asDateInput(a.expires_at),
      urgency: a.urgency ?? "",
    };
    setForm(fields);
    setOriginal(fields);
    setImage(null);
    setCurrentImage(a.image_url ?? null);
    setOpen(true);
  };

  /*
   * The post being written, kept until it is saved or discarded — a new one
   * under one name, each edit under its post's. The photo is not kept: a
   * picked file cannot be written down, so it is chosen again. An edit's
   * version is the post as it was opened, so a correction saved elsewhere
   * is never overwritten by old typing.
   */
  const draft = useModalDraft<typeof blank>(
    editId ? `edit-post:${editId}` : "new-post",
    open,
    form,
    (kept) => setForm({ ...original, ...kept }),
    { blank: original, reset: () => setForm(original), version: editId ? JSON.stringify(original) : null },
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();

      /*
       * Everything is sent, blanks included, so clearing a field actually
       * clears it. The server then drops whatever does not belong to the
       * chosen kind — a post changed from Event to Announcement must not
       * keep a venue nobody can see to remove.
       */
      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, typeof value === "boolean" ? (value ? "1" : "0") : value);
      });

      if (image) payload.append("image", image);

      if (editId) {
        // Multipart cannot be sent as a real PUT through PHP — Laravel reads
        // the method from this field instead.
        payload.append("_method", "PUT");
        await contentApi.updatePost(editId, payload, {
          headers: { "Content-Type": "multipart/form-data" },
          ...upload.tracker,
        });
        upload.finish();
        toast("Post updated — the public site now shows the correction.");
      } else {
        await contentApi.createPost(payload, {
          headers: { "Content-Type": "multipart/form-data" },
          ...upload.tracker,
        });
        upload.finish();
        toast(
          form.status === "Published"
            ? "Posted — it now appears in News & Announcements."
            : "Saved as a draft. Nobody outside the office can see it yet."
        );
      }
      draft.clear();
      setOpen(false);
      load();
    } catch (err) {
      /* Clear the bar. Left up, a failed upload sits at whatever percentage
         it died on and reads as still working. */
      upload.fail();
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (announcement: Announcement) => {
    if (
      !(await confirmAction({
        title: "Delete this post?",
        text: `"${announcement.title}" will be removed from the public site.`,
        confirmText: "Yes, delete",
        danger: true,
      }))
    )
      return;
    try {
      await contentApi.deletePost(announcement.id);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((a) => a.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await contentApi.reorderPosts({ ids });
    load();
  };

  return {
    pageLoad,
    user, rows, setRows, counts, setCounts, statusFilter, setStatusFilter, page, setPage,
    lastPage, setLastPage, total, setTotal, loading, setLoading, saving, setSaving, open,
    setOpen, editId, setEditId, blank, form, setForm, image, setImage, currentImage,
    setCurrentImage, set, kind, uses, load, upload, openAdd, openEdit, save, remove, move, draft,
  };
}

export type PostDeskState = ReturnType<typeof usePostDesk>;
