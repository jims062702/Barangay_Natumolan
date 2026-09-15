<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Services\Population\Analytics;

class AnalyticsController extends BaseController
{
    public function index(Analytics $analytics)
    {
        return $this->success($analytics->summary(), 'Population analytics retrieved');
    }
}
