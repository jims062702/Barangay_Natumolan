<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Models\Service\Certificate;
use App\Models\Service\Guide;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Http\Request;

/** What the counter screen needs before it files anything: forms, fees, requirements, numbers. */
class CertificateCatalogueController extends BaseController
{
    /**
     * The whole schedule and every form the barangay issues.
     *
     * One call rather than three: the counter screen needs the types, the
     * questions each one asks, and all seventy-odd amounts at the same
     * moment — it is filling in one form.
     */
    public function feeSchedule()
    {
        return $this->success(
            CertificateCatalogue::forClient(),
            'Certificate catalogue and the fee schedule of Ordinance of 18 January 2020'
        );
    }

    /**
     * Documentary requirements per certificate type, read from the service
     * guide knowledge base so the barangay can change what it asks for
     * without a code change. Returns [] when no guide is published.
     */
    public function requirements(Request $request)
    {
        $type = $request->input('certificate_type');

        $guide = Guide::where('is_active', true)
            ->where(function ($q) use ($type) {
                // Guides are named for the service; certificate types are the
                // shortened labels, so match either direction.
                $q->where('service_name', $type)
                    ->orWhere('service_name', 'like', $type . '%');
            })
            ->first();

        $items = collect(explode(',', (string) $guide?->requirements))
            ->map(fn ($item) => trim($item))
            ->filter()
            // Present them capitalised — guides are written in running prose.
            ->map(fn ($item) => ucfirst($item))
            ->values();

        return $this->success([
            'certificate_type' => $type,
            'requirements' => $items,
            'source_guide' => $guide?->service_name,
        ], 'Documentary requirements retrieved');
    }

    /**
     * The number series this office issues under, and where it has reached.
     *
     * A device that has to keep working with no line needs both: the prefix
     * that is its alone, and the last number spent, so it can carry on from
     * there. Fetched while the line is up and kept on the device.
     *
     * Only the caller's OWN series is disclosed. Which numbers another
     * office has reached is not this device's business, and sending it
     * would invite a device to mint into a series it does not own.
     */
    public function numberSeries()
    {
        $office = auth()->user()?->office;
        $prefix = Certificate::seriesPrefix($office);

        $highest = Certificate::where('certificate_number', 'like', $prefix . '%')
            ->selectRaw(
                'MAX(CAST(SUBSTRING(certificate_number, ' . (strlen($prefix) + 1) . ') AS UNSIGNED)) AS highest'
            )
            ->value('highest');

        return $this->success([
            'office' => $office,
            'prefix' => $prefix,
            'width' => Certificate::NUMBER_WIDTH,
            /* The next free one, so the device does not have to add a
               number to a number and get the arithmetic wrong. */
            'next' => ((int) $highest) + 1,
        ], 'Number series');
    }
}
