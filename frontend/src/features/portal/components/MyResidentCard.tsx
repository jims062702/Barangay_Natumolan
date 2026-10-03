import { useEffect, useState } from "react";
import { FiShield, FiCreditCard } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import Card from "../../../shared/ui/Card";
import { ResidentCardView } from "../../../shared/residentCard/ResidentCardView";
import type { ResidentCardData } from "../../../shared/residentCard/drawCard";
import { portalApi } from "../api";

/**
 * My Profile → Barangay Resident Card / ID.
 *
 * Drawn from the register, so there is nothing here to fill in or correct:
 * the card says what the barangay holds. Only shown once the Population Office
 * has actually issued a card for the resident.
 */
export function MyResidentCard() {
  const [card, setCard] = useState<ResidentCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    portalApi.residentCard()
      .then((r) => setCard((r.data.data as ResidentCardData) || null))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card title="Barangay Resident Card / ID">
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="aspect-[856/540] w-full animate-pulse rounded-[4%] bg-secondary" />
          <div className="aspect-[856/540] w-full animate-pulse rounded-[4%] bg-secondary" />
        </div>
      ) : error ? (
        <p className="rounded-xl bg-secondary px-4 py-6 text-center text-sm text-gray-600" data-testid="resident-card-error">
          {error}
        </p>
      ) : card ? (
        <>
          <div className="-mt-2 mb-4 flex gap-3 rounded-2xl bg-primary/5 px-4 py-3">
            <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-dark">
              Your ID is made from your barangay record. <strong>Download</strong> it and upload the file
              whenever an online complaint asks for your Barangay Resident ID, or <strong>print</strong> it.
              Its QR code holds only a check code — not your name or address.
            </p>
          </div>

          <ResidentCardView
            card={card}
            note="The details on the card cannot be edited here. If something is wrong, visit the Population Office — they correct your record and can print you a new card (which replaces this one)."
          />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray bg-secondary/30 px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FiCreditCard className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-dark">No Barangay Resident ID Issued Yet</h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-gray-500">
            Your Barangay Resident ID has not yet been issued by the Barangay Population Office.
            Once the Population Office issues your ID card, it will appear here ready to view, download, or print.
          </p>
        </div>
      )}
    </Card>
  );
}
