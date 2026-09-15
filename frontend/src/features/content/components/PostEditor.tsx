import { FiCheck } from "react-icons/fi";
import Modal from "../../../shared/ui/Modal";
import FormField, { inputClasses } from "../../../shared/ui/FormField";
import FileField from "../../../shared/ui/FileField";
import { POST_KINDS, KIND, KIND_FIELDS, URGENCIES } from "../lib/postKinds";
import { STATUSES } from "../lib/postDesk";
import type { PostDeskState } from "../hooks/usePostDesk";

/**
 * Writing or changing a post; the fields shown follow the kind of post.
 */
export function PostEditor({ ctx }: { ctx: PostDeskState }) {
  const {
    open, setOpen, editId, save, set, kind, form, uses, currentImage, image, setImage, upload,
    saving,
  } = ctx;

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit post" : "New post"} wide>
      <form onSubmit={save} className="space-y-4">
        {/*
          The kind comes FIRST, because it decides what the rest of the form
          asks for. Chosen from a row rather than a dropdown so all five are
          visible at once with what each is for — the Event/Activity
          distinction is the one people get wrong, and it is not obvious
          from a closed list.
        */}
        <FormField label="What kind of post is this?" required plain>
          <div className="flex flex-wrap gap-2">
            {POST_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set("category", k)}
                aria-pressed={kind === k}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  kind === k
                    ? "bg-primary text-white ring-2 ring-primary/25"
                    : `${KIND[k].tone} hover:opacity-80`
                }`}
              >
                {/*
                  A tick on the chosen one.

                  Five chips already wear five colours to say what KIND they
                  are, so the chosen one being purple is one more colour
                  among colours — there is nothing to compare it against.
                  The tick says "this is the one" in a way that does not
                  depend on telling five shades apart.
                */}
                {kind === k && <FiCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                {k}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">{KIND[kind].purpose}</p>
        </FormField>

        <FormField label="Title" required>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            required
            maxLength={255}
            className={inputClasses}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Posted by" hint="The name residents see under the title.">
            <input
              value={form.author_name}
              onChange={(e) => set("author_name", e.target.value)}
              maxLength={120}
              placeholder="e.g. SK Secretary"
              className={inputClasses}
            />
          </FormField>
          <FormField label="Status" required>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={inputClasses}
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField
          label="Short description"
          hint="One line, shown on the card. Left empty, the opening of the details is used."
        >
          <input
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            maxLength={300}
            className={inputClasses}
          />
        </FormField>

        <FormField label="Full details" required>
          <textarea
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            required
            rows={5}
            className={`${inputClasses} resize-none`}
          />
        </FormField>

        {/*
          Only the fields this KIND uses. An Announcement asked for a venue
          and an expiry date is a form nobody finishes, and the answers
          typed into boxes that do not apply are the ones that end up on the
          public page contradicting the post beside them.
        */}
        {KIND_FIELDS[kind].length > 0 && (
          <div className="rounded-xl border border-gray bg-secondary/40 p-4">
            <p className="mb-3 text-sm font-semibold text-dark">
              {kind === "Event" && "When and where it happens"}
              {kind === "Activity" && "When it was done"}
              {kind === "Advisory" && "How long it applies"}
              {kind === "Program" && "Where residents go for it"}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {uses("event_at") && (
                <FormField label="Event date" hint="What a resident writes on their calendar.">
                  <input
                    type="date"
                    value={form.event_at}
                    onChange={(e) => set("event_at", e.target.value)}
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("event_time") && (
                <FormField label="Time">
                  <input
                    value={form.event_time}
                    onChange={(e) => set("event_time", e.target.value)}
                    maxLength={60}
                    placeholder="8:00 AM – 12:00 NN"
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("completed_at") && (
                <FormField label="Date completed">
                  <input
                    type="date"
                    value={form.completed_at}
                    onChange={(e) => set("completed_at", e.target.value)}
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("location") && (
                <FormField label="Venue">
                  <input
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                    maxLength={255}
                    placeholder="Barangay Covered Court"
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("organizer") && (
                <FormField label="Organiser">
                  <input
                    value={form.organizer}
                    onChange={(e) => set("organizer", e.target.value)}
                    maxLength={150}
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("participants") && (
                <FormField label="Who took part" hint="Offices, groups or volunteers.">
                  <input
                    value={form.participants}
                    onChange={(e) => set("participants", e.target.value)}
                    maxLength={255}
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("contact_info") && (
                <FormField label="Who to contact" hint="A name or a number residents can reach.">
                  <input
                    value={form.contact_info}
                    onChange={(e) => set("contact_info", e.target.value)}
                    maxLength={150}
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("registration_deadline") && (
                <FormField label="Register until">
                  <input
                    type="date"
                    value={form.registration_deadline}
                    onChange={(e) => set("registration_deadline", e.target.value)}
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("effective_at") && (
                <FormField label="In effect from">
                  <input
                    type="date"
                    value={form.effective_at}
                    onChange={(e) => set("effective_at", e.target.value)}
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("expires_at") && (
                <FormField
                  label="Until"
                  hint="After this the advisory drops off the public page by itself."
                >
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => set("expires_at", e.target.value)}
                    className={inputClasses}
                  />
                </FormField>
              )}
              {uses("urgency") && (
                <FormField label="Urgency">
                  <select
                    value={form.urgency}
                    onChange={(e) => set("urgency", e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">—</option>
                    {URGENCIES.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>
          </div>
        )}

        <FormField
          label={editId ? "Replace photo (optional)" : "Photo (optional)"}
          hint={
            editId
              ? "Leave this empty to keep the photo already on the post."
              : "Shown on the card and at the top of the post. JPG/PNG up to 5MB."
          }
        >
          <div className="space-y-2">
            {editId && currentImage && (
              <div className="flex items-center gap-3">
                <img
                  src={currentImage}
                  alt="Current photo on this post"
                  className="h-14 w-20 shrink-0 rounded-lg object-cover"
                />
                <span className="text-xs text-gray-500">Photo currently in use</span>
              </div>
            )}
            <FileField
              file={image}
              onPick={setImage}
              progress={upload.progress}
              done={upload.done}
            />
          </div>
        </FormField>

        <button
          type="submit"
          disabled={saving}
          className="w-full cursor-pointer rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {saving
            ? editId
              ? "Saving…"
              : "Posting…"
            : editId
              ? "Save changes"
              : form.status === "Published"
                ? "Publish post"
                : "Save draft"}
        </button>
      </form>
    </Modal>
  );
}
