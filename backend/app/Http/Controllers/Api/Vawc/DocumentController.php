<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Vawc\StoreDocumentRequest;
use App\Http\Requests\Vawc\UpdateDocumentRequest;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\Document;
use Illuminate\Http\Request;

/**
 * The confidential document register: per case and across the desk.
 */
class DocumentController extends BaseController
{
    /** 2.4 — the confidential document register across every case. */
    public function index(Request $request)
    {
        $query = Document::with(['vawcCase:id,case_code,violence_type,status', 'uploader:id,name']);

        if ($request->filled('document_type')) {
            $query->where('document_type', $request->document_type);
        }

        return $this->success(
            $query->latest()->paginate(20),
            'VAWC documents retrieved'
        );
    }

    public function forCase(CaseFile $case)
    {
        AccessLog::record($case->id, 'documents_viewed');

        return $this->success([
            'documents' => $case->documents()->with('uploader:id,name')->latest()->get(),
            'incidents' => $case->incidents,
        ], 'Documents retrieved');
    }

    public function store(StoreDocumentRequest $request, CaseFile $case)
    {
        $validated = $request->validated();

        $document = $case->documents()->create($validated + ['uploaded_by' => auth()->id()]);

        AccessLog::record($case->id, 'document_added', $validated['title']);

        return $this->success($document, 'Document recorded', 201);
    }

    /**
     * Correct a document's particulars — its type, title, description or the
     * file reference locating the physical copy. The document itself is never
     * replaced here, and the change is written to the access trail.
     */
    public function update(UpdateDocumentRequest $request, Document $document)
    {
        $validated = $request->validated();

        $document->update($validated);

        AccessLog::record($document->vawc_case_id, 'document_updated', $document->title);

        $document->load(['vawcCase:id,case_code,violence_type,status', 'uploader:id,name']);

        return $this->success($document, 'Document updated');
    }
}
