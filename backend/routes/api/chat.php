<?php

use App\Http\Controllers\Api\Chat\ResidentChatController;
use Illuminate\Support\Facades\Route;

/*
| Live chat, the resident's side.
*/

/*
| Live-agent chat — REGISTERED RESIDENTS, signed in.
|
| It was open to anyone, on the reasoning that whoever most needs a human is
| on the landing page without an account. In practice one Secretary answers
| one person at a time, and an anonymous form in front of that queue fills it
| with people the barangay cannot identify, cannot reach afterwards, and
| cannot hold to anything. Signing in also means the name, email and number
| are already on the record, so nobody is asked to type them again.
|
| The chatbot on the same widget stays open to everyone; it is the handoff to
| a person that needs an account.
*/
Route::middleware('auth:sanctum')->group(function () {
    Route::post('chat/start', [ResidentChatController::class, 'start'])->middleware('throttle:10,1');
    // Resumes the resident's own thread without the browser-stored token,
    // so a chat started on a laptop is there on their phone.
    Route::get('chat/mine', [ResidentChatController::class, 'mine']);
    /*
     * Resolved conversations, which the resident keeps. Declared before the
     * token route below — its 48-character constraint would not match
     * "history" anyway, but the order says the intent.
     */
    Route::get('chat/history', [ResidentChatController::class, 'history']);
    /*
    | The token pattern is pinned to the 48 random characters the server
    | issues. Without it `chat/{token}` is declared first and would swallow
    | the staff desk's own `chat/conversations`, matching it as a token.
    */
    Route::get('chat/{token}', [ResidentChatController::class, 'thread'])->where('token', '[A-Za-z0-9]{48}');
    Route::post('chat/{token}/messages', [ResidentChatController::class, 'sendMessage'])
        ->where('token', '[A-Za-z0-9]{48}')->middleware('throttle:60,1');
    /*
    | One more question on a conversation the desk had finished with.
    |
    | Its own route rather than a flag on `messages`, because it does more
    | than post a line: it takes the conversation out of Closed and puts it
    | back in the queue, which is a different act with a different audit trail.
    */
    Route::post('chat/{token}/follow-up', [ResidentChatController::class, 'followUp'])
        ->where('token', '[A-Za-z0-9]{48}')
        ->middleware('throttle:20,1');

    Route::post('chat/{token}/end', [ResidentChatController::class, 'endConversation'])
        ->where('token', '[A-Za-z0-9]{48}');
});
