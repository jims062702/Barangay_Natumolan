import { useEffect, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { Link, useParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import logo from "../../../assets/logo/barangay-logo.png";
import { publicApi } from "../api";

interface IdCheck {
  valid: boolean;
  message: string;
  resident_number: string | null;
  masked_name: string | null;
  issued_on: string | null;
}

/**
 * The page a Barangay Resident ID's QR opens.
 *
 * It says whether the card is a valid, current card of this barangay — and
 * whose, only in part ("JU** DE** CR**"), with the resident number, so the
 * person holding the card can be matched to it without the page telling a
 * stranger anybody's name, address or birthday.
 */
export default function VerifyResidentId() {
  const { code = "" } = useParams();
  const [check, setCheck] = useState<IdCheck | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    publicApi.residentIdStatus(encodeURIComponent(code))
      .then((r) => setCheck(r.data.data as IdCheck))
      .catch((err) => setError(errorMessage(err)));
  }, [code]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          <FiArrowLeft aria-hidden="true" /> Back to website
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <img src={logo} alt="Barangay Natumolan logo" className="mx-auto h-14 w-14" />
            <h1 className="mt-3 text-xl font-bold text-dark">Resident ID Verification</h1>
            <p className="mt-1 text-sm text-gray-500">Barangay Natumolan, Tagoloan, Misamis Oriental</p>
          </div>

          {error && <p className="text-center text-sm font-medium text-danger">{error}</p>}
          {!check && !error && <p className="text-center text-sm text-gray-400">Checking the card…</p>}

          {check && (
            <div
              data-testid="resident-id-result"
              className={`rounded-2xl border p-5 ${check.valid ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}`}
            >
              <div className="flex items-center gap-2">
                {check.valid
                  ? <FiCheckCircle className="h-6 w-6 text-success" aria-hidden="true" />
                  : <FiXCircle className="h-6 w-6 text-danger" aria-hidden="true" />}
                <p className={`font-bold ${check.valid ? "text-success" : "text-danger"}`}>
                  {check.valid ? "Valid Barangay Resident ID" : "Not a valid Resident ID"}
                </p>
              </div>
              {check.valid ? (
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Resident Number</dt>
                    <dd className="font-mono font-semibold text-dark">{check.resident_number}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Name</dt>
                    <dd className="font-medium text-dark">{check.masked_name}</dd>
                  </div>
                  {check.issued_on && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Card issued</dt>
                      <dd className="font-medium text-dark">{new Date(check.issued_on).toLocaleDateString("en-PH", { dateStyle: "long" })}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-gray-600">{check.message}</p>
              )}
            </div>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-gray-400">
            Only part of the name is shown. Compare it, and the resident number, with the card.
          </p>
        </div>
      </div>
    </div>
  );
}
