import { useCertificateRows } from "./useCertificateRows";
import { useCertificateFiling } from "./useCertificateFiling";
import { useCertificateRecord } from "./useCertificateRecord";

/**
 * The state and handlers of <CertificateList>, so its sections can share them.
 */
export function useCertificateDesk() {
  const list = useCertificateRows();
  const filing = useCertificateFiling(list);
  const record = useCertificateRecord(list);

  return { ...list, ...filing, ...record };
}

export type CertificateDeskState = ReturnType<typeof useCertificateDesk>;
