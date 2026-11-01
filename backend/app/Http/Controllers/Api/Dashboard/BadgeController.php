<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Api\BaseController;
use App\Models\Lupon\CaseFile as LuponCase;
use App\Models\Chat\Conversation;
use App\Models\Lupon;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Models\Vawc;
use App\Support\ManilaTime;
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

        $cacheKey = "badges:user_{$user->id}:{$role}:{$office}";
        $cached = \Illuminate\Support\Facades\Cache::get($cacheKey);
        if ($cached !== null && is_array($cached)) {
            return $this->success($cached, 'Sidebar counts retrieved');
        }

        $isAdmin = $office === 'Admin';
        $frontDesk = $isAdmin || in_array($office, ['Main Office'], true);
        $isSecretary = $isAdmin || in_array($role, ['Secretary', 'Punong Barangay'], true) || ($office === 'Main Office' && $role !== 'Clerk');
        $isLupon = $isAdmin || $office === 'Lupon' || $role === 'Lupon Secretary';

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
            $badges['/resident/requests'] = ServiceRequest::where('resident_id', $mine)
                ->whereNotIn('status', ['Completed', 'Rejected'])
                ->count();

            /*
             * The two halves of "My cases", counted apart.
             *
             * "Somebody filed a complaint against me" is the one a resident
             * opens the portal to find, and as a single number beside "My
             * cases" it was indistinguishable from a case they filed
             * themselves. Two entries, two counts.
             *
             * OPEN CASES ONLY. A settled case is not something waiting for
             * them, and a badge that never clears is a badge nobody reads.
             */
            $closed = ['Settled', 'Dismissed', 'Referred'];

            /* Counted as the portal lists them: once the summons is served. */
            $badges['/resident/lupon/against-me'] = LuponCase::whereNotIn('current_stage', $closed)
                ->whereHas('respondents', fn ($q) => $q->where('residents.id', $mine))
                ->summonsIssued()
                ->count();

            $badges['/resident/lupon/filed'] = LuponCase::whereNotIn('current_stage', $closed)
                ->where('complainant_id', $mine)
                ->where('current_stage', '!=', 'Closed — Unpaid')
                ->count();

            $badges['/resident/lupon/complaints'] = \App\Models\Lupon\OnlineComplaint::where('resident_id', $mine)
                ->where('status', \App\Models\Lupon\OnlineComplaint::FOR_VERIFICATION)
                ->count();

            /*
             * Sittings still ahead of them, on any case either side.
             *
             * The one badge on this menu a person can be PENALISED for
             * ignoring: a summons names a day, and a number beside Hearings
             * is what turns "sometime" into "twice this month".
             *
             * Nothing behind them is counted. A hearing already held is not
             * waiting for anybody, and a badge that never clears is a badge
             * that stops being read.
             */
            $badges['/resident/lupon/hearings'] = DB::table('lupon_hearings')
                ->where('status', 'Scheduled')
                ->where('scheduled_at', '>=', now()->startOfDay())
                /* Only on cases whose summons has been printed — the same
                   line the portal itself draws. Counting from proof of
                   service put a number beside a menu whose list was still
                   empty, because the case only appears once the paper
                   exists. */
                ->whereIn('lupon_case_id', DB::table('lupon_hearings')
                    ->where('summons_issued', true)
                    ->select('lupon_case_id'))
                ->whereIn('lupon_case_id', function ($q) use ($mine) {
                    $q->select('id')->from('lupon_cases')->where('complainant_id', $mine)
                        ->union(
                            DB::table('lupon_case_respondents')
                                ->select('lupon_case_id')
                                ->where('resident_id', $mine)
                        );
                })
                ->count();

            /*
             * VAWC Records badges for resident:
             * - Online complaints waiting for verification
             * - Active confidential cases / Cases against me
             * - Active / applied protection orders
             */
            $isMaleResident = $user->resident && strcasecmp((string) $user->resident->gender, 'Male') === 0;

            if ($isMaleResident) {
                // Male residents only see "Cases Against Me" under VAWC Records
                $badges['/resident/vawc/cases'] = \App\Models\Vawc\CaseFile::where('respondent_id', $mine)
                    ->where('status', 'Active')
                    ->count();
            } else {
                $badges['/resident/vawc/reports'] = \App\Models\Vawc\OnlineReport::where('resident_id', $mine)
                    ->where('status', 'For Verification')
                    ->count();

                $badges['/resident/vawc/cases'] = \App\Models\Vawc\CaseFile::where(function ($q) use ($mine) {
                        $q->where('survivor_id', $mine)->orWhere('reported_by_resident_id', $mine);
                    })
                    ->where('status', 'Active')
                    ->count();

                $badges['/resident/vawc/bpo'] = \App\Models\Vawc\ProtectionOrder::whereIn('vawc_case_id', function ($q) use ($mine) {
                        $q->select('id')->from('vawc_cases')->where('survivor_id', $mine);
                    })
                    ->whereIn('status', ['Applied', 'Issued'])
                    ->count();
            }

            /*
             * Case History & Tracking carries no badge. It is an activity log.
             */

            return $this->success(array_filter($badges), 'Sidebar counts retrieved');
        }

        if ($frontDesk) {
            /*
             * FOUR COUNTS ARE GONE, and none of them was being read.
             *
             * /services, /queue, /referrals and /records were keyed to menu
             * entries that came off the sidebar. A badge is looked up BY PATH,
             * so with no entry to sit on each of these was a database query
             * run on every sidebar refresh, for every signed-in clerk, whose
             * answer was then thrown away.
             *
             * /queue and /referrals have no page left at all. /services and
             * /records still have a route but no menu entry — if either comes
             * back to the sidebar, its count comes back with it.
             */

            /*
             * Everything short of released or cancelled: accepted, printed,
             * signed, waiting to be claimed. All of them are a resident
             * waiting on the office for something.
             */
            $badges['/certificates'] = Certificate::whereNotIn(
                'status',
                ['Released', 'Cancelled']
            )->count();

        }

        /*
         * The live desk, which the CLERK staffs — and was the one account
         * the badge was kept from, left over from when the Secretary had it.
         * Waiting conversations AND unread replies in the ones being handled:
         * both are somebody on the other end of a chat window, watching for
         * an answer. The Clerk's alone: the desk is closed to the Secretary
         * and the Punong Barangay.
         */
        if ($role === 'Clerk') {
            $badges['/chat'] = Conversation::where('status', 'Waiting')->count()
                + (int) Conversation::where('status', 'Active')->sum('unread_for_agent');
        }

        if ($isLupon) {
            // A case still moving through the KP process.
            $badges['/lupon/cases'] = Lupon\CaseFile::whereNotIn(
                'current_stage',
                Lupon\CaseFile::CLOSED_STAGES
            )->count();

            // Online complaints waiting for Lupon verification
            $badges['/lupon/online-complaints'] = Lupon\OnlineComplaint::where(
                'status',
                Lupon\OnlineComplaint::FOR_VERIFICATION
            )->count();
        }

        if ($isSecretary || $isLupon) {
            $today = ManilaTime::today();

            $hearingTypes = [];
            if ($isAdmin) {
                $hearingTypes = ['Mediation', 'Conciliation'];
            } elseif ($isSecretary) {
                $hearingTypes = ['Mediation'];
            } elseif ($isLupon) {
                $hearingTypes = ['Conciliation'];
            }

            // Today's Hearing: active scheduled sittings for today (cancelled cases and hearings excluded)
            $badges['/lupon/hearings'] = DB::table('lupon_hearings')
                ->join('lupon_cases', 'lupon_hearings.lupon_case_id', '=', 'lupon_cases.id')
                ->whereIn('lupon_hearings.hearing_type', $hearingTypes)
                ->where('lupon_hearings.status', 'Scheduled')
                ->whereDate('lupon_hearings.scheduled_at', $today)
                ->whereNotIn('lupon_cases.current_stage', ['Filed', 'For Summons', 'Withdrawn', 'Cancelled', 'Settled', 'Closed - Unpaid', 'Closed Unpaid'])
                ->count();

            // Upcoming Hearing: cases with upcoming scheduled hearings (cancelled cases and hearings excluded)
            $badges['/lupon/hearings/upcoming'] = DB::table('lupon_hearings')
                ->join('lupon_cases', 'lupon_hearings.lupon_case_id', '=', 'lupon_cases.id')
                ->whereIn('lupon_hearings.hearing_type', $hearingTypes)
                ->whereNotIn('lupon_cases.current_stage', ['Filed', 'For Summons', 'Withdrawn', 'Cancelled', 'Settled', 'Closed - Unpaid', 'Closed Unpaid'])
                ->where('lupon_hearings.status', '!=', 'Cancelled')
                ->whereDate('lupon_hearings.scheduled_at', '>', $today)
                ->whereRaw('lupon_hearings.id = (
                    SELECT h2.id FROM lupon_hearings h2
                    WHERE h2.lupon_case_id = lupon_hearings.lupon_case_id
                      AND DATE(h2.scheduled_at) > ?
                      AND h2.status != \'Cancelled\'
                    ORDER BY h2.scheduled_at ASC, h2.id ASC
                    LIMIT 1
                )', [$today])
                ->count();

            // Past Hearings: sittings that already ran before today or completed (cancelled excluded)
            $badges['/lupon/hearings/past'] = DB::table('lupon_hearings')
                ->join('lupon_cases', 'lupon_hearings.lupon_case_id', '=', 'lupon_cases.id')
                ->whereIn('lupon_hearings.hearing_type', $hearingTypes)
                ->whereNotIn('lupon_cases.current_stage', ['Filed', 'For Summons', 'Withdrawn', 'Cancelled', 'Settled', 'Closed - Unpaid', 'Closed Unpaid'])
                ->where('lupon_hearings.status', '!=', 'Cancelled')
                ->where(function ($q) use ($today) {
                    $q->whereDate('lupon_hearings.scheduled_at', '<', $today)
                      ->orWhere('lupon_hearings.status', 'Completed');
                })
                ->count();

            // Cancelled (Withdrawn) cases
            $cancelledQuery = Lupon\CaseFile::whereIn('current_stage', ['Withdrawn', 'Cancelled']);
            if (! $isAdmin) {
                if ($isSecretary) {
                    $cancelledQuery->whereDoesntHave('hearings', fn ($q) => $q->where('hearing_type', 'Conciliation'));
                }
            }
            $badges['/lupon/hearings/cancelled'] = $cancelledQuery->count();

            // CFA Cases (Lupon only; Secretary menu no longer displays CFA Cases)
            if ($isAdmin || $isLupon) {
                $cfaQuery = Lupon\CaseFile::where('current_stage', 'CFA');
                if (! $isAdmin && $isLupon) {
                    $cfaQuery->where(function ($q) {
                        $q->whereHas('hearings', fn ($h) => $h->where('hearing_type', 'Conciliation'))
                          ->orWhereNotNull('assigned_lupon_secretary');
                    });
                }
                $badges['/lupon/hearings/cfa'] = $cfaQuery->count();
            }
        }

        /*
         * CASES FORWARDED TO THIS DESK, WAITING ON A SUMMONS.
         *
         * The one number on this menu that is somebody's own backlog rather
         * than the room's: nothing is on any calendar until the paper is
         * printed, so a case sitting here is invisible everywhere else. Each
         * desk counts only its own — the Secretary's Tuesdays-to-be and the
         * Lupon's Thursdays-to-be are different work, and a shared figure
         * would have each office chasing the other's.
         */
        /*
         * COUNTED FROM THE PAPER, NOT FROM THE STAGE.
         *
         * A case carried over from the old order stands at Mediation with
         * three Tuesdays already on the calendar and no summons ever
         * printed — real work, and a badge keyed to the waiting stages
         * alone walked straight past it. It said 1 above a list showing 4.
         */
        $waitingFor = [
            'Main Office' => ['For Summons', 'Mediation'],
            'Lupon' => ['For Lupon Summons', 'Conciliation'],
            /* Admin stands in for whichever desk is short-handed, so it
               counts both waiting rooms. */
            'Admin' => ['For Summons', 'Mediation', 'For Lupon Summons', 'Conciliation'],
        ];

        $unprinted = "(SELECT COUNT(*) FROM lupon_hearings h
              WHERE h.lupon_case_id = lupon_cases.id
                AND h.summons_issued = 1
                AND h.hearing_type = CASE
                      WHEN lupon_cases.current_stage IN ('For Lupon Summons','Conciliation')
                      THEN 'Conciliation' ELSE 'Mediation' END) = 0";

        /* The Clerk is Main Office too, and the KP is no part of their work:
           without this they would run this query on every sidebar refresh
           for a menu entry they do not have. */
        if ($role !== 'Punong Barangay' && $role !== 'Clerk' && isset($waitingFor[$office])) {
            $badges['/lupon/hearings/for-summons'] = Lupon\CaseFile::whereIn(
                'current_stage',
                $waitingFor[$office]
            )->whereRaw($unprinted)->count();
        }

        // Confidential by law and by design: this number leaves the VAWC desk
        // for nobody, not even the Punong Barangay.
        if ($office === 'VAWC') {
            $badges['/vawc/cases'] = Vawc\CaseFile::where('status', 'Active')->count();
            /* Reports residents sent online, waiting to be verified. */
            $badges['/vawc/online-reports'] = Vawc\OnlineReport::where('status', Vawc\OnlineReport::FOR_VERIFICATION)->count();
        }

        if ($isAdmin || $office === 'Population') {
            // Issued but never activated — the resident cannot sign in yet.
            /* On the sidebar's "Not activated" list, the one it counts. */
            $badges['/population/accounts/not-activated'] = DB::table('users')
                ->whereNotNull('resident_id')
                ->whereNull('activated_at')
                ->count();

            // Activated resident portal accounts.
            $badges['/population/accounts/activated'] = DB::table('users')
                ->whereNotNull('resident_id')
                ->whereNotNull('activated_at')
                ->count();
        }

        $result = array_filter($badges);
        \Illuminate\Support\Facades\Cache::put($cacheKey, $result, 10);

        // Zero is the same as nothing to a reader, and sending it invites the
        // sidebar to draw an empty badge.
        return $this->success($result, 'Sidebar counts retrieved');
    }
}
