import { useEffect, useState } from "react";
import { FiShield } from "react-icons/fi";
import { errorMessage } from "../../../shared/lib/api";
import Card from "../../../shared/ui/Card";
import { ResidentCardView } from "../../../shared/residentCard/ResidentCardView";
import type { ResidentCardData } from "../../../shared/residentCard/drawCard";
import { portalApi } from "../api";

/**
 * My Profile → Barangay Resident Card / ID.
 *
 * Drawn from the register, so there is nothing here to fill in or correct:
 * the card says what the barangay holds. A wrong detail is corrected at the
 * Population Office, and the card follows.
 */
export function MyResidentCard() {
  const [card, setCard] = useState<ResidentCardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    portalApi.residentCard()
      .then((r) => setCard(r.data.data as ResidentCardData))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <Card title="Barangay Resident Card / ID">
      <div className="-mt-2 mb-4 flex gap-3 rounded-2xl bg-primary/5 px-4 py-3">
        <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-dark">
          Your ID is made from your barangay record. <strong>Download</strong> it and upload the file
          whenever an online complaint asks for your Barangay Resident ID, or <strong>print</strong> it.
          Its QR code holds only a check code — not your name or address.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-secondary px-4 py-6 text-center text-sm text-gray-600" data-testid="resident-card-error">{error}</p>
      ) : card ? (
        <ResidentCardView
          card={card}
          note="The details on the card cannot be edited here. If something is wrong, visit the Population Office — they correct your record and can print you a new card (which replaces this one)."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="aspect-[856/540] w-full animate-pulse rounded-[4%] bg-secondary" />
          <div className="aspect-[856/540] w-full animate-pulse rounded-[4%] bg-secondary" />
        </div>
      )}
    </Card>
  );
}
