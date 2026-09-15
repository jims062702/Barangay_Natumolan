<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Resident\ImportRegisterRequest;
use App\Services\Resident\RegisterExport;
use App\Services\Resident\RegisterImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Getting the register in and out as a spreadsheet.
 *
 * CSV by default, Excel on request — see RegisterExport. Preview before
 * import, always — see RegisterImport.
 */
class TransferController extends BaseController
{
    public function export(Request $request, RegisterExport $export): StreamedResponse
    {
        return $export->download($request);
    }

    /** An empty file with the right header, so nobody has to guess the columns. */
    public function template(RegisterExport $export): StreamedResponse
    {
        return $export->template();
    }

    /**
     * Reads a CSV and says what it WOULD do — without doing any of it.
     *
     * The office is handing this system a file from somewhere else. Running
     * it blind and reporting afterwards is how a bad column mapping becomes
     * four hundred wrong records, so the preview is not optional politeness:
     * it is the only chance anybody gets to look.
     */
    public function preview(Request $request, RegisterImport $registerImport): JsonResponse
    {
        if (!$this->canWrite()) {
            return $this->forbidden('Your office cannot import into the resident registry');
        }

        $request->validate(ImportRegisterRequest::RULES);

        $parsed = $registerImport->plan($request->file('file'));

        if (isset($parsed['error'])) {
            return $this->error($parsed['error'], 422);
        }

        return $this->success($parsed, 'Import preview ready — nothing has been saved.');
    }

    /** Does what the preview described. */
    public function import(Request $request, RegisterImport $registerImport): JsonResponse
    {
        if (!$this->canWrite()) {
            return $this->forbidden('Your office cannot import into the resident registry');
        }

        $request->validate(ImportRegisterRequest::RULES);

        $parsed = $registerImport->plan($request->file('file'));

        if (isset($parsed['error'])) {
            return $this->error($parsed['error'], 422);
        }

        if ($parsed['summary']['errors'] > 0 && !$request->boolean('skip_bad_rows')) {
            return $this->error(
                $parsed['summary']['errors'] . ' row(s) have problems. Fix them, or import '
                    . 'again with "skip the bad rows" if you want the rest anyway.',
                422,
                ['rows' => array_slice($parsed['rows'], 0, 50)]
            );
        }

        [$created, $updated, $skipped, $households, $couples] = array_values($registerImport->apply($parsed));

        return $this->success(
            compact('created', 'updated', 'skipped', 'households', 'couples'),
            $created . ' added, ' . $updated . ' updated'
                . ($households ? ', ' . $households . ' household(s) created' : '')
                . ($couples ? ', ' . $couples . ' couple(s) linked' : '')
                . ($skipped ? ', ' . $skipped . ' skipped' : '') . '.'
        );
    }

    private function canWrite(): bool
    {
        return in_array(auth()->user()?->office, ['Population', 'Admin'], true);
    }
}
