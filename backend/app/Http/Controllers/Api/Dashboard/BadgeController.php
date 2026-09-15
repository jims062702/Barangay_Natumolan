<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Api\BaseController;
use App\Models\Chat\Conversation;
use App\Models\Lupon;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Models\Vawc;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BadgeController extends BaseController
{
    /**
     * How much work is waiting behind each item in the sidebar.
     *
     * A clerk should not have to open five pages to find out which of them
     * needs them. The number beside a menu item answers that from where they
     * already are, and its absence is just as useful: nothing there, keep
     * going.
     *
     * Keyed by ROUTE, not by module, because the same page appears on several
     * menus — /certificates is on the Clerk's, the Main Office's, the Punong
     * Barangay's and the Admin's — and one count serves all of them.
     *
     * Each figure means the same kind of thing: items in a state that is
     * waiting for somebody in THIS office to act. Not "how many exist" —
     * a badge showing 20 released certificates would be noise on a permanent
     * setting, and a clerk would learn to ignore it within a day.
     *
     * The office gates mirror `menuFor()` on the client and the middleware on
     * the routes. They are not decoration: without them this endpoint would
     * report how many confidential VAWC cases are open to every account in
     * the barangay.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $office = $user->office;
        $role = $user->role;

        $isAdmin = $office === 'Admin';
        $frontDesk = $isAdmin || in_array($office, ['Main Office'], true);
        $lupon = $isAdmin || $office === 'Lupon' || $role === 'Punong Barangay';

        $badges = [];

        /*
         * A resident's own menu. Their numbers answer a different question
         * from the staff's — not "what must I do" but "what has happened
         * to my request" — and the most useful of them is a certificate
         * waiting at the hall that nobody has told them about.
         */
        if ($user->resident_id) {
            $mine = $user->resident_id;

            /*
             * Requests and certificates are one page for the resident, so
             * they are one number. What it counts is what is still moving:
             * anything not yet finished, plus a document that is signed and
             * waiting at the counter for them to collect.
             */
            $badges['/portal/requests'] = ServiceRequest::where('resident_id', $mine)
                ->whereNotIn('status', ['Completed', 'Rejected'])
                ->count();

            $badges['/portal/appointments'] = DB::table('appointments')
                ->where('resident_id', $mine)
                ->whereIn('status', ['Scheduled', 'Confirmed'])
                ->where('scheduled_datetime', '>=', now()->startOfDay())
                ->count();

            return $this->success(array_filter($badges), 'Sidebar counts retrieved');
        }

        if ($frontDesk) {
            // Filed and untouched — the intake nobody has picked up.
            $badges['/services'] = ServiceRequest::where('status', 'Pending')->count();

            // Anybody physically at the window right now.
            $badges['/queue'] = DB::table('office_queue')
                ->whereIn('status', ['Waiting', 'Called', 'Serving'])
                ->count();

            /*
             * Everything short of released or cancelled: accepted, printed,
             * signed, waiting to be claimed. All of them are a resident
             * waiting on the office for something.
             */
            $badges['/certificates'] = Certificate::whereNotIn(
                'status',
                ['Released', 'Cancelled']
            )->count();

            // Booked and still ahead of us — a past appointment needs nothing.
            $badges['/appointments'] = DB::table('appointments')
                ->whereIn('status', ['Scheduled', 'Confirmed'])
                ->where('scheduled_datetime', '>=', now()->startOfDay())
                ->count();

            $badges['/referrals'] = DB::table('referrals')
                ->whereIn('status', ['Pending', 'Acknowledged', 'In Progress'])
                ->count();

            // Drafted but not yet adopted by the Punong Barangay.
            $badges['/records'] = DB::table('administrative_records')
                ->whereNull('approved_at')
                ->where('is_archived', false)
                ->count();
        }

        /*
         * The live desk, which the Clerk does not staff. Waiting conversations
         * AND unread replies in the one being handled: both are somebody on
         * the other end of a chat window, watching for an answer.
         */
        if ($frontDesk && $role !== 'Clerk') {
            $badges['/chat'] = Conversation::where('status', 'Waiting')->count()
                + (int) Conversation::where('status', 'Active')->sum('unread_for_agent');
        }

        if ($lupon) {
            // A case still moving through the KP process.
            $badges['/lupon/cases'] = Lupon\CaseFile::whereNotIn(
                'current_stage',
                ['Settled', 'Dismissed', 'Referred']
            )->count();

            $badges['/lupon/hearings'] = DB::table('lupon_hearings')
                ->where('status', 'Scheduled')
                ->count();
        }

        // Confidential by law and by design: this number leaves the VAWC desk
        // for nobody, not even the Punong Barangay.
        if ($office === 'VAWC') {
            $badges['/vawc/cases'] = Vawc\CaseFile::where('status', 'Active')->count();
        }

        if ($isAdmin || $office === 'Population') {
            // Issued but never activated — the resident cannot sign in yet.
            $badges['/population/accounts'] = DB::table('users')
                ->whereNotNull('resident_id')
                ->whereNull('activated_at')
                ->count();
        }

        // Zero is the same as nothing to a reader, and sending it invites the
        // sidebar to draw an empty badge.
        return $this->success(array_filter($badges), 'Sidebar counts retrieved');
    }
}
