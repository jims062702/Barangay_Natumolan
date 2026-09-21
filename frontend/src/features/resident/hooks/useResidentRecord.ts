import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../shared/auth/AuthContext";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import type { Resident, FamilyMember } from "../../../shared/types";
import { MANUAL_SECTORS } from "../lib/sectors";
import { memberName } from "../components/family/memberFormat";
import { residentApi } from "../api";
import { populationApi } from "../../population/api";
import type { Relation } from "../components/addRelative/types";

/**
 * The state and handlers of <ResidentDetail>, so its sections can share them.
 */
export function useResidentRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [resident, setResident] = useState<Resident | null>(null);
  const [loadError, setLoadError] = useState("");
  const [sectorOpen, setSectorOpen] = useState(false);
  const [sectorType, setSectorType] = useState(MANUAL_SECTORS[0]);
  /*
   * The card behind a tag. Solo Parent is a registration under RA 8972, not
   * something the office concludes from looking at a household — so the ID
   * number is asked for, and the server refuses the tag without it.
   */
  const [sectorRef, setSectorRef] = useState("");
  const [sectorIssued, setSectorIssued] = useState("");
  const [sectorValidUntil, setSectorValidUntil] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  // Which of Add parent / Add child / Add spouse is open, if any.
  const [relation, setRelation] = useState<Relation | null>(null);
  /*
   * The guardian whose arrangement is being ended. Ending is not unlinking:
   * the parents coming home is a fact about the child's life and the row
   * stays, while a carer recorded against the wrong child is a mistake and
   * goes. Two buttons, because only the clerk knows which one it is.
   */
  const [endingGuardian, setEndingGuardian] = useState<FamilyMember | null>(null);

  const isBpo = user?.office === "Population" || user?.role === "Admin";
  const canEdit =
    ["Main Office", "Population"].includes(user?.office ?? "") ||
    ["Punong Barangay", "Admin"].includes(user?.role ?? "");

  /*
   * Puts the address right once the record says what it is.
   *
   * A non-resident reached from a family panel or a search lands on
   * /residents/911, where the sidebar can only conclude "Residents" —
   * the URL carries no way to know otherwise, and neither does anything
   * else reading it. Replacing rather than pushing keeps the correction
   * out of the back button.
   */
  useEffect(() => {
    if (!resident || !id) return;

    const belongs = resident.record_type === "Non-resident"
      ? `/residents/non-residents/${id}`
      : `/residents/${id}`;

    if (pathname !== belongs) {
      navigate(belongs, { replace: true });
    }
  }, [resident, id, pathname, navigate]);

  const load = () => {
    residentApi.resident(id)
      .then((r) => {
        setResident(r.data.data);
        setLoadError("");
      })
      // Swallowing this was hiding a broken page behind stale data: the
      // previous resident stayed on screen as though it were the new one.
      .catch((err) => setLoadError(errorMessage(err)));
  };

  useEffect(() => {
    /*
     * Clear FIRST. The family panel links to other profiles, which is the
     * same route with a different id — React re-renders rather than
     * remounting, so without this the previous person's record (and their
     * family) stays on screen until the fetch lands. Clicking your way from a
     * parent to their child therefore showed the PARENT's family under the
     * child's name, which reads exactly like "the link did not save".
     */
    setResident(null);
    setLoadError("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addSector = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await residentApi.addSector(id, {
        sector_type: sectorType,
        enrolled_date: new Date().toISOString().slice(0, 10),
        reference_no: sectorRef || undefined,
        issued_on: sectorIssued || undefined,
        valid_until: sectorValidUntil || undefined,
      });
      setSectorOpen(false);
      setSectorRef("");
      setSectorIssued("");
      setSectorValidUntil("");
      toast(`Tagged as ${sectorType}.`);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const removeSector = async (sectorId: number, label: string) => {
    if (
      !(await confirmAction({
        title: `Remove "${label}"?`,
        text: "This sector tag will be removed from the resident.",
        confirmText: "Yes, remove",
        danger: true,
      }))
    )
      return;
    try {
      await residentApi.removeSector(id, sectorId);
      toast(`Removed ${label}.`);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /** Removes a family link recorded in error. The person stays registered. */
  const unlinkRelative = async (member: FamilyMember, kind: Relation) => {
    if (
      !(await confirmAction({
        title: `Remove ${memberName(member)} as ${kind}?`,
        text: "Only the family link is removed — their resident record is kept.",
        confirmText: "Yes, remove the link",
        danger: true,
      }))
    )
      return;
    try {
      await residentApi.unlinkRelative(id, member.id, { params: { relation: kind } });
      toast("Family link removed.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /**
   * Issues a portal account for a record that predates automatic accounts, or
   * whose email was missing at registration. New registrations never need this.
   */
  const issueAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !(await confirmAction({
        title: "Issue a portal account?",
        text: `A login will be created for ${accountEmail} and emailed to them.`,
        confirmText: "Yes, issue it",
      }))
    )
      return;
    try {
      const response = await populationApi.createResidentAccount(id, {
        email: accountEmail || undefined,
      });
      setAccountOpen(false);
      toast(
        `${response.data.message} Temporary password: ${response.data.data.password}`
      );
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /** "I never got the email" — sends a fresh activation code. */
  const resendActivation = async () => {
    if (!resident?.account) return;
    try {
      const response = await populationApi.resendActivation(
        resident.account.id
      );
      toast(response.data.message);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  // Open the change-password modal with the default password pre-filled.

  return {
    id, navigate, pathname, user, resident, setResident, loadError, setLoadError, sectorOpen,
    setSectorOpen, sectorType, setSectorType, sectorRef, setSectorRef, sectorIssued,
    setSectorIssued, sectorValidUntil, setSectorValidUntil, accountOpen, setAccountOpen,
    accountEmail, setAccountEmail,
    relation, setRelation, endingGuardian, setEndingGuardian, isBpo, canEdit, load, addSector,
    removeSector, unlinkRelative, issueAccount, resendActivation,
  };
}

export type ResidentRecordState = ReturnType<typeof useResidentRecord>;
