import type { Certificate } from "../../../shared/types";
import { buildCertificateHtml } from "./certificateTemplates";
import type { Catalogue } from "../types";
import type { CouncilMember, PrintableCertificate } from "./certificate/types";

/**
 * Opens the barangay's own form, filled in, and prints it.
 *
 * What was here printed one paragraph under every heading — "is issued this
 * {type} for the purpose of: {purpose}" — over a signature block reading
 * HON. RICARDO M. BALAGTAS, who is a name from the demonstration data. The
 * office was never going to use it, so they kept making the real documents
 * in Word.
 */
export function openPrintView(
  certificate: Certificate,
  council: CouncilMember[],
  catalogue: Catalogue | null,
) {
  const spec = catalogue?.types.find((t) => t.name === certificate.certificate_type);

  const win = window.open("", "_blank", "width=900,height=1000");

  if (!win) return;

  win.document.write(
    buildCertificateHtml(certificate as unknown as PrintableCertificate, council, {
      letterhead: spec?.letterhead ?? "plain",
      office: spec?.office ?? "Punong Barangay",
    }),
  );
  win.document.close();
}
