<?php

namespace App\Http\Requests\Content;

class StoreAnnouncementRequest extends AnnouncementRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
