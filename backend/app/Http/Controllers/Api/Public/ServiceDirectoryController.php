<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;

/** What the barangay offers, and how to reach it — for the landing page. */
class ServiceDirectoryController extends BaseController
{
    public function services()
    {
        return $this->success([
            'Main Office' => [
                'Barangay Clearance',
                'Certificate of Residency',
                'Certificate of Indigency',
                'First-Time Jobseeker Certification',
                'Certificate of Low or No Income',
                'Business Barangay Clearance',
            ],
            'VAWC Office' => [
                'Complaint Intake',
                'Case Assistance',
                'Referral Services',
            ],
            'Lupon' => [
                'Case Filing',
                'Mediation Services',
                'Conciliation',
            ],
            'Health Station' => [
                'Medical Consultation',
                'Immunization',
                'Prenatal Care',
                'Child Health Checkup',
            ],
        ], 'Available services');
    }

    public function contact()
    {
        return $this->success([
            'barangay_name' => 'Barangay Natumolan',
            'municipality' => 'Tagoloan',
            'province' => 'Misamis Oriental',
            'phone' => '(XXX) XXX-XXXX',
            'email' => 'barangay@tagoloan.gov.ph',
            'office_hours' => '8:00 AM - 5:00 PM, Monday to Friday',
        ], 'Contact information');
    }
}
