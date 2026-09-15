import Modal from "../../../shared/ui/Modal";
import { useRegisterTransfer } from "../hooks/useRegisterTransfer";
import { ExportSection } from "./transfer/ExportSection";
import { ImportSection } from "./transfer/ImportSection";

/**
 * Getting the register in and out as a spreadsheet.
 *
 * The import half never runs blind. The office is handing this system a file
 * from somewhere else — another barangay's export, a list typed up in Excel,
 * last year's backup — and a preview is the only chance anybody gets to look
 * before four hundred records change. So the flow is fixed: choose a file,
 * read what WOULD happen, then decide.
 */

export default function TransferModal({
  open,
  mode,
  onClose,
  onImported,
}: {
  open: boolean;
  /**
   * One job per opening.
   *
   * Taking data out and bringing data in are different errands, and the
   * second one writes. Putting both behind one button meant a clerk who
   * came to fetch a backup was one mis-click from a file upload — so they
   * are separate buttons, and each opens on the thing it says.
   */
  mode: "import" | "export";
  onClose: () => void;
  onImported: () => void;
}) {
  const ctx = useRegisterTransfer({ open, mode, onClose, onImported });
  const {
    close,
  } = ctx;

  return (
    /*
      Wide, because both halves are lists.

      The preview is a table of names against what would happen to each, and
      a clerk deciding whether to run it has to be able to read it. In a
      narrow box the names wrapped onto three lines and four rows filled the
      window — which is a preview nobody can check.
    */
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={mode === "export" ? "Export resident data" : "Import resident data"}
    >
      <div className="space-y-5">
        {/* ---------------- export ---------------- */}
        {mode === "export" && (
        <ExportSection ctx={ctx} />
        )}

        {/* ---------------- import ---------------- */}
        {mode === "import" && (
        <ImportSection ctx={ctx} />
        )}
      </div>
    </Modal>
  );
}

