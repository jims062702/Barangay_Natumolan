<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Models\Service\Certificate;
use App\Services\Service\CertificatePhoto;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Http\Request;

/** The counter photograph for a Barangay Clearance with Picture. */
class CertificatePhotoController extends BaseController
{
    public function __construct(private readonly CertificatePhoto $photo)
    {
    }

    /**
     * The photograph for a Barangay Clearance with Picture.
     *
     * Taken at the counter and uploaded. Refused once the document has been
     * printed, for the same reason the wording is: after that, the paper in
     * the resident's hand and the record here must agree.
     *
     * The two thumbmarks are NOT uploaded. They are inked onto the printed
     * sheet, and a system that offered to capture them would be claiming to
     * have witnessed something it did not.
     */
    public function upload(Request $request, Certificate $certificate)
    {
        if (! CertificateCatalogue::needsPhoto($certificate->certificate_type)) {
            return $this->error(
                'A ' . $certificate->certificate_type . ' does not carry a photograph. '
                    . 'Change the type to "Barangay Clearance with Picture" first.',
                422
            );
        }

        if ($certificate->printed_at) {
            return $this->error(
                'This certificate has already been printed, so its photograph can no longer be changed.',
                409
            );
        }

        $request->validate(['photo' => 'required|image|max:5120']);

        $uploadedPath = app(\App\Services\Cloudinary\CloudinaryService::class)->upload($request->file('photo'), CertificatePhoto::DIRECTORY)
            ?? $request->file('photo')->store(CertificatePhoto::DIRECTORY, 'public');

        $this->photo->attach($certificate, $uploadedPath);

        /* fresh() on its own reloads the columns and none of the relations —
           which is what blanked the holder in the counter's window. */
        return $this->success(
            $certificate->fresh(Certificate::COUNTER_RELATIONS),
            'Photograph attached. It prints in the box beside the thumbmarks.'
        );
    }

    /**
     * The same photograph, sent as data instead of a file upload.
     *
     * For a device that took the photo with no line. A file upload cannot be
     * held in the offline queue and replayed later — the browser will not
     * keep a File across a restart — so the device shrinks the picture and
     * sends it as a data URL, which the queue can store like any other text.
     *
     * The same rules as a normal upload apply: only a type that carries a
     * photograph, and not once the paper has been printed.
     */
    public function uploadData(Request $request, Certificate $certificate)
    {
        if (! CertificateCatalogue::needsPhoto($certificate->certificate_type)) {
            return $this->error(
                'A ' . $certificate->certificate_type . ' does not carry a photograph.',
                422
            );
        }

        if ($certificate->printed_at) {
            return $this->error(
                'This certificate has already been printed, so its photograph can no longer be changed.',
                409
            );
        }

        $request->validate(['photo_data' => 'required|string']);

        $path = $this->photo->storeDataUrl((string) $request->input('photo_data'));

        if ($path === null) {
            return $this->error('The photograph could not be read. Take it again.', 422);
        }

        $this->photo->attach($certificate, $path);

        return $this->success($certificate->fresh(Certificate::COUNTER_RELATIONS), 'Photograph attached.');
    }
}
