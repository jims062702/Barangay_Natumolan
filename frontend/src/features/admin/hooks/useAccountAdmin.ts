import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../../shared/auth/AuthContext";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { authApi } from "../../../shared/auth/api";
import type { User } from "../../../shared/types";
import { ROLE_OFFICE } from "../lib/roles";
import { adminApi } from "../api";

/**
 * The state and handlers of <UserManagement>, so its sections can share them.
 */
export function useAccountAdmin({
  /*
   * Which register this is. Taken from the route rather than a tab, so the
   * two lists are two places in the sidebar and each keeps its own address.
   */
  kind = "staff",
}: {
  kind?: "staff" | "resident";
} = {}) {
  const { user, refresh } = useAuth();
  const [rows, setRows] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  /* Both totals, so this page can point at the other register rather than
     leaving somebody to click the sidebar to find out if it is empty. */
  const [counts, setCounts] = useState<{ staff: number; resident: number }>();

  /*
   * Your own account, which is no longer in the list below.
   *
   * Taking the row away removes the accidental Deactivate — and would also
   * have left the administrator with nowhere at all to correct their own name
   * or email, since no other screen reaches `auth/profile`. This is that
   * screen. It has no Deactivate and no Delete, which is the whole point.
   */
  const [selfOpen, setSelfOpen] = useState(false);
  const [selfName, setSelfName] = useState("");
  const [selfEmail, setSelfEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [selfPassword, setSelfPassword] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  /* The account being corrected. Null is the create form. */
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Clerk");

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    adminApi.users({ params: { page, kind, search: search || undefined } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
        setCounts(r.data.data.counts);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, kind]);

  // Live updates without a manual refresh.
  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("users", () => load(true));

  const openSelf = () => {
    setSelfName(user?.name ?? "");
    setSelfEmail(user?.email ?? "");
    setCurrentPassword("");
    setSelfPassword("");
    setSelfOpen(true);
  };

  const saveSelf = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await authApi.updateProfile({ name: selfName, email: selfEmail });

      /*
       * The password is a separate call because it asks for the current one.
       * Changing your OWN password without proving you know it would make a
       * borrowed unlocked screen enough to take the account.
       */
      if (selfPassword) {
        await authApi.changePassword({
          current_password: currentPassword,
          new_password: selfPassword,
          new_password_confirmation: selfPassword,
        });
      }

      toast("Your account has been updated.");
      setSelfOpen(false);
      setCurrentPassword("");
      setSelfPassword("");
      await refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const startEdit = (user: User) => {
    setEditing(user);
    setName(user.name);
    setEmail(user.email);
    /* Blank means "leave it alone" — see the note on the field itself. */
    setPassword("");
    setRole(user.role);
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;

    try {
      await adminApi.updateUser(editing.id, {
        name,
        email,
        /* Only sent when something was typed. An empty string here would set
           the password to an empty string, which is a door. */
        ...(password ? { password } : {}),
        /* A resident account keeps its role: changing it would turn somebody
           on the register into a staff member without any office deciding so. */
        ...(editing.role === "Resident"
          ? {}
          : { role, office: ROLE_OFFICE[role] }),
      });

      toast(`${name} updated.`);
      setEditing(null);
      setPassword("");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await confirmAction({ title: "Save this staff account?", confirmText: "Yes, save" }))) return;
    try {
      await adminApi.createUser({
        name,
        email,
        password,
        role,
        office: ROLE_OFFICE[role],
      });
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      toast("Staff account created.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /**
   * Delete, which the server may refuse.
   *
   * Five kinds of record hold a staff account in place — an ordinance filed,
   * a health visit, an immunisation, a VAWC document, a follow-up. The server
   * checks and answers in a sentence; this only has to show it.
   */
  const remove = async (user: User) => {
    if (
      !(await confirmAction({
        title: `Delete ${user.name}?`,
        text: "Their account and sign-in are removed for good. If they have filed anything, the system will refuse and you should deactivate instead.",
        confirmText: "Yes, delete",
        cancelText: "Cancel",
      }))
    )
      return;

    try {
      await adminApi.deleteUser(user.id);
      toast(`${user.name} deleted.`);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const toggle = async (user: User) => {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active });
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return {
    user, refresh, rows, setRows, search, setSearch, page, setPage, lastPage, setLastPage,
    total, setTotal, loading, setLoading, counts, setCounts, selfOpen, setSelfOpen, selfName,
    setSelfName, selfEmail, setSelfEmail, currentPassword, setCurrentPassword, selfPassword,
    setSelfPassword, createOpen, setCreateOpen, editing, setEditing, name, setName, email,
    setEmail, password, setPassword, role, setRole, load, openSelf, saveSelf, startEdit,
    saveEdit, create, remove, toggle,
  };
}

export type AccountAdminState = ReturnType<typeof useAccountAdmin>;
