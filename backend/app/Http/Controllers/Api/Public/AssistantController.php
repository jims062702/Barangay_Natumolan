<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Public\AssistantInquiryRequest;
use App\Services\Public\GuideAssistant;

/** The landing page's service-guide assistant. */
class AssistantController extends BaseController
{
    public function ask(AssistantInquiryRequest $request, GuideAssistant $assistant)
    {
        return $this->success($assistant->answer($request->validated()['message']), 'Assistant response');
    }
}
