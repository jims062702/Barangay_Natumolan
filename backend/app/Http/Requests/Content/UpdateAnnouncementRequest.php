<?php

namespace App\Http\Requests\Content;

class UpdateAnnouncementRequest extends AnnouncementRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
