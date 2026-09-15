import { FiPlus } from "react-icons/fi";
import PageHeader from "../../../shared/ui/PageHeader";
import { useRecordArchive } from "../hooks/useRecordArchive";
import { RecordTable } from "../components/RecordTable";
import { RecordFormModal } from "../components/RecordFormModal";
import { RecordViewModal } from "../components/RecordViewModal";

export default function AdministrativeRecords() {
  const ctx = useRecordArchive();
  const {
    openCreate,
  } = ctx;

  return (
    <div>
      <PageHeader
        title="Barangay Administrative Records"
        subtitle="Ordinances, resolutions, executive orders, minutes and official documents"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> File document
          </button>
        }
      />

      <RecordTable ctx={ctx} />

      <RecordFormModal ctx={ctx} />

      <RecordViewModal ctx={ctx} />
    </div>
  );
}

