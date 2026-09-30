<?php

namespace App\Models\Lupon;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A photograph or document attached to an online complaint.
 *
 * OPTIONAL, ALWAYS. Somebody with a picture of the moved fence should be
 * able to send it; somebody without one should not be stopped from
 * reporting anything at all. The path is into `storage/app/private` — none
 * of this is served from the public disk.
 */
class OnlineComplaintFile extends Model
{
    protected $fillable = ['online_complaint_id', 'path', 'original_name', 'mime_type', 'size_bytes'];

    public function complaint(): BelongsTo
    {
        return $this->belongsTo(OnlineComplaint::class, 'online_complaint_id');
    }
}
