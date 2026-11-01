<?php

namespace App\Services\Lupon;

use App\Models\Lupon\OnlineComplaint;
use App\Models\Resident\Resident;
use App\Support\ManilaTime;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Taking a complaint in over the web, without letting it become a case.
 *
 * Two doors lead here and they differ only in who the filer is:
 *
 *   a RESIDENT       identified by their Barangay Resident ID, whose QR
 *                    code is checked against the register (ResidentCards);
 *                    their record is the truth about them, so it is read
 *   a NON-RESIDENT   nothing to look up; they type their own details
 *
 * Somebody who says they live here and whose card does not check out does
 * not get this far: the controller refuses them at the door.
 *
 * Both end in the same place: a reference number, a status of "For
 * Office Verification", and a complaint that is not a case. Nothing in this
 * file writes to `lupon_cases` — see OnlineComplaintController::accept for
 * the one place that does, which is a person at a desk pressing a button.
 */
final class OnlineFiling
{
    /** Where a valid ID goes: never the public disk. */
    public const ID_DIR = 'online-complaints/ids';

    /** Where an optional attachment goes. */
    public const EVIDENCE_DIR = 'online-complaints/evidence';

    /**
     * @param array<string, mixed> $data the validated submission
     * @param UploadedFile $validId the photograph of the filer's ID
     * @param UploadedFile[] $evidence optional, and usually empty
     */
    public function file(array $data, UploadedFile $validId, array $evidence = []): OnlineComplaint
    {
        return DB::transaction(function () use ($data, $validId, $evidence) {
            $resident = null;

            if (($data['filer_kind'] ?? 'Non-resident') === 'Resident') {
                $resident = isset($data['resident_id'])
                    ? Resident::find($data['resident_id'])
                    : null;

                /* Refused at the door already; never filed without a record. */
                if (! $resident) {
                    throw new \RuntimeException('A resident filer must be on the register.');
                }
            }

            $year = (int) substr(ManilaTime::today(), 0, 4);

            $complaint = OnlineComplaint::create([
                'reference_no' => OnlineComplaint::nextReference($year),
                'filer_kind' => $data['filer_kind'],
                'resident_id' => $resident?->id,
                /* The Barangay Resident ID that identified them. */
                'resident_card_id' => $resident ? ($data['resident_card_id'] ?? null) : null,
                /* Written down as typed, even for a registered resident: the
                   register keeps their details CURRENT, and the office still
                   has to see what was submitted on the day. */
                'complainant_name' => $data['complainant_name'],
                'complainant_address' => $data['complainant_address'],
                'complainant_contact' => $data['complainant_contact'],
                'respondent_name' => $data['respondent_name'],
                'respondent_address' => $data['respondent_address'] ?? null,
                'case_classification' => $data['case_classification'] ?? null,
                'narrative' => $data['narrative'],
                'date_of_occurrence' => $data['date_of_occurrence'] ?? null,
                'place_of_occurrence' => $data['place_of_occurrence'] ?? null,
                'relationship_nature' => $data['relationship_nature'] ?? null,
                'valid_id_type' => $data['valid_id_type'],
                'valid_id_number' => $data['valid_id_number'] ?? null,
                'valid_id_path' => $validId->store(self::ID_DIR, 'local'),
                'status' => OnlineComplaint::FOR_VERIFICATION,
            ]);

            foreach ($evidence as $file) {
                $complaint->files()->create([
                    'path' => $file->store(self::EVIDENCE_DIR, 'local'),
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getClientMimeType(),
                    'size_bytes' => $file->getSize(),
                ]);
            }

            $complaint = $complaint->fresh(['files', 'resident']);

            /* The Lupon hears of it now — once, when it arrives, never on a
               refresh. A notice that cannot be written does not lose the
               complaint: it is reported, and the queue still shows it. */
            try {
                OnlineComplaintNotice::toLupon($complaint);
            } catch (\Throwable $failure) {
                report($failure);
            }

            // Sync to Cloudinary in the background after the response is sent to user
            app()->terminating(function () use ($complaint) {
                try {
                    $idLocalPath = $complaint->valid_id_path;
                    if ($idLocalPath && !str_starts_with($idLocalPath, 'http')) {
                        $fullPath = \Illuminate\Support\Facades\Storage::disk('local')->path($idLocalPath);
                        if (file_exists($fullPath)) {
                            $cloudUrl = app(\App\Services\Cloudinary\CloudinaryService::class)->upload($fullPath, 'complaint-ids');
                            if ($cloudUrl) {
                                $complaint->update(['valid_id_path' => $cloudUrl]);
                            }
                        }
                    }
                } catch (\Throwable $e) {
                    report($e);
                }

                try {
                    foreach ($complaint->files as $file) {
                        if ($file->path && !str_starts_with($file->path, 'http')) {
                            $fullEvPath = \Illuminate\Support\Facades\Storage::disk('local')->path($file->path);
                            if (file_exists($fullEvPath)) {
                                $evCloudUrl = app(\App\Services\Cloudinary\CloudinaryService::class)->upload($fullEvPath, 'complaint-evidence');
                                if ($evCloudUrl) {
                                    $file->update(['path' => $evCloudUrl]);
                                }
                            }
                        }
                    }
                } catch (\Throwable $e) {
                    report($e);
                }
            });

            return $complaint;
        });
    }
}
