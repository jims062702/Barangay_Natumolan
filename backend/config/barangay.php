<?php

/*
|--------------------------------------------------------------------------
| The people the barangay's reports are addressed to or signed by — the
| ones who are NOT on the officials roster.
|--------------------------------------------------------------------------
|
| The Punong Barangay and the Barangay Secretary are read from the roster
| (Council\Official), which the office already keeps. These are the rest:
| the court the KP transmittal goes to, the DILG officer it is copied to,
| and the VAW Desk person who submits the VAW-C reports. Their names are the
| ones on the barangay's own forms; each can be set in .env when it changes,
| and every printed form also lets the office correct the name before it
| prints.
*/

return [
    'signatories' => [
        'presiding_judge' => env('BRGY_PRESIDING_JUDGE', 'KATHRYN A. GALARRITA'),
        'court_place' => env('BRGY_COURT_PLACE', 'Tagoloan, Misamis Oriental'),
        'mlgoo' => env('BRGY_MLGOO', 'MARIA NILDA C. VELOSO'),
        'vaw_desk' => env('BRGY_VAW_DESK', 'GINA E. CAAYAMAN'),
    ],

    /*
    | The chatbot's limit for somebody NOT signed in: this many messages a
    | day per DEVICE, spam included — so people sharing one Wi-Fi each have
    | their own. A network may be given this many new devices a day, so
    | clearing the browser over and over does not start the day again.
    | See App\Services\Chat\GuestAllowance. Residents who sign in are not
    | limited.
    */
    'chat' => [
        'guest_daily_limit' => (int) env('CHAT_GUEST_DAILY_LIMIT', 10),
        'guest_new_devices_per_network' => (int) env('CHAT_GUEST_NEW_DEVICES_PER_NETWORK', 30),
        'guest_window_hours' => 24,
        /* Once the desk has answered, how long the resident has to reply
           before the conversation closes by itself (IdleConversations). */
        'idle_close_hours' => (int) env('CHAT_IDLE_CLOSE_HOURS', 24),
    ],
];
