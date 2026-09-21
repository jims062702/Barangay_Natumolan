<?php

namespace App\Http\Controllers\Api\Chat;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Chat\ChatMessageRequest;
use App\Models\Chat\Conversation;
use App\Services\Chat\ConversationViews;
use App\Services\Chat\DeskNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Live-agent chat, the resident's side.
 *
 * The chatbot answers what it can. When it cannot — or the person simply asks
 * for a human — the conversation is handed to the BARANGAY SECRETARY, who
 * staffs the live desk. Everything here is plain polling over the existing
 * REST API: no websocket server to keep alive, which matters for a barangay
 * office running this on a single machine.
 *
 * A conversation is addressed by an unguessable session token, and only the
 * signed-in resident it belongs to can open it with that token.
 */
class ResidentChatController extends BaseController
{
    public function __construct(
        private readonly ConversationViews $views,
        private readonly DeskNotifier $desk,
    ) {
    }

    /**
     * Opens a conversation with the live desk.
     *
     * Registered residents only, and signed in. The desk is one Clerk
     * answering one person at a time, and an anonymous form on a public page
     * is an invitation to fill that queue with people the barangay has no way
     * to identify, reach afterwards, or hold to anything. Signing in also
     * means the name, email and number are already on the record — so the
     * form that used to ask for them is gone.
     */
    public function start(Request $request)
    {
        $resident = $this->callerResidentId();

        if (!$resident) {
            return $this->forbidden(
                'The live desk is for registered residents. Sign in to your portal account '
                    . 'and the Clerk will see who they are talking to.'
            );
        }

        $validated = $request->validate([
            'topic' => 'nullable|string|max:120',
            'message' => 'required|string|max:2000',
        ]);

        /*
         * One open conversation per resident. Pressing "talk to a human"
         * twice must not put the same person in the queue twice, ahead of
         * everybody who only pressed it once.
         */
        $existing = Conversation::where('resident_id', $resident)
            ->whereIn('status', ['Waiting', 'Active'])
            ->latest('id')
            ->first();

        if ($existing) {
            $existing->addMessage('visitor', $validated['message']);

            if ($existing->status === 'Waiting') {
                $this->desk->notify($existing, $validated['message']);
            }

            return $this->success([
                'session_token' => $existing->session_token,
                'conversation' => $this->views->visitor($existing->fresh()),
            ], 'You already have a conversation open — your message was added to it.');
        }

        $conversation = Conversation::create([
            'session_token' => Conversation::newSessionToken(),
            'resident_id' => $resident,
            'topic' => $validated['topic'] ?? null,
            'status' => 'Waiting',
        ]);

        $conversation->addMessage(
            'system',
            'Conversation started. Waiting for the Barangay Clerk to join.'
        );
        $conversation->addMessage('visitor', $validated['message']);

        $this->desk->notify($conversation, $validated['message']);

        return $this->success([
            'session_token' => $conversation->session_token,
            'conversation' => $this->views->visitor($conversation->fresh()),
        ], 'You are in the queue — the Barangay Clerk will be with you shortly', 201);
    }

    /**
     * The resident's own conversation, without needing the token.
     *
     * The token lives in one browser's storage. Signing in on a phone after
     * starting on a laptop, or simply clearing site data, used to lose the
     * thread — and with it whatever the Clerk had already answered. The
     * account is the durable handle now; the token is just the message key.
     */
    public function mine()
    {
        $resident = $this->callerResidentId();

        if (!$resident) {
            return $this->forbidden('The live desk is for registered residents.');
        }

        $conversation = Conversation::where('resident_id', $resident)
            ->whereIn('status', ['Waiting', 'Active'])
            ->latest('id')
            ->first();

        /*
         * Closed conversations are not open, but they are not gone either —
         * see `history`. The count travels even when there is nothing open,
         * so the widget can offer them without a second request.
         */
        $past = Conversation::where('resident_id', $resident)
            ->where('status', 'Closed')
            ->count();

        if (!$conversation) {
            return $this->success(
                ['conversation' => null, 'past_conversations' => $past],
                'No conversation open'
            );
        }

        $conversation->forceFill(['unread_for_visitor' => 0])->save();

        return $this->success([
            'session_token' => $conversation->session_token,
            'conversation' => $this->views->visitor($conversation),
            'past_conversations' => $past,
            'messages' => $conversation->messages()->get()->map(fn ($m) => $this->views->message($m)),
        ], 'Conversation retrieved');
    }

    /**
     * Every conversation this resident has had, newest first.
     *
     * Resolving one does not delete anything — `close` writes a system line
     * and flips the status — but `mine` only ever returned an OPEN one, so
     * the moment the Clerk marked a conversation resolved it vanished
     * from the resident's side. The answer they had been given went with it.
     *
     * That is the wrong way round. The resident is the one who has to act on
     * what was said: which office, which day, what to bring. The desk can
     * look a thread up again whenever it likes; the resident could not.
     *
     * Only the outline here. The thread itself is read through `thread`,
     * which already serves a closed conversation to the resident who owns it.
     */
    public function history()
    {
        $resident = $this->callerResidentId();

        if (!$resident) {
            return $this->forbidden('The live desk is for registered residents.');
        }

        $rows = Conversation::where('resident_id', $resident)
            ->withCount('messages')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(function (Conversation $conversation) {
                /*
                 * The resident's own first line, as the label. A list of
                 * dates says nothing about which conversation was which —
                 * "my clearance" is what they are looking for.
                 */
                $opening = $conversation->messages()
                    ->where('sender', 'visitor')
                    ->orderBy('id')
                    ->value('body');

                return [
                    'session_token' => $conversation->session_token,
                    'status' => $conversation->status,
                    'started_at' => $conversation->created_at?->toDateTimeString(),
                    'closed_at' => $conversation->closed_at?->toDateTimeString(),
                    'agent_name' => $conversation->agent?->name,
                    'messages' => $conversation->messages_count,
                    'opening' => $opening ? Str::limit(trim($opening), 80) : null,
                ];
            });

        return $this->success(['conversations' => $rows], 'Conversation history retrieved');
    }

    /** The visitor's own view of the thread, newest last. */
    public function thread(string $token)
    {
        $conversation = $this->ownedConversation($token);

        if (!$conversation) {
            return $this->notFound('That conversation could not be found');
        }

        // Reading the thread is what clears the visitor's unread badge.
        $conversation->forceFill(['unread_for_visitor' => 0])->save();

        return $this->success([
            'conversation' => $this->views->visitor($conversation),
            'messages' => $conversation->messages()->get()->map(fn ($m) => $this->views->message($m)),
        ], 'Conversation retrieved');
    }

    public function sendMessage(ChatMessageRequest $request, string $token)
    {
        $validated = $request->validated();

        $conversation = $this->ownedConversation($token);

        if (!$conversation) {
            return $this->notFound('That conversation could not be found');
        }

        if ($conversation->status === 'Closed') {
            return $this->error('This conversation has been closed. Start a new one if you still need help.', 409);
        }

        $message = $conversation->addMessage('visitor', $validated['body']);

        // Only ring the desk again when nobody has picked this up yet — an
        // agent already in the conversation sees it in their open thread.
        if ($conversation->status === 'Waiting') {
            $this->desk->notify($conversation, $validated['body']);
        }

        return $this->success($this->views->message($message), 'Message sent', 201);
    }

    /**
     * One more question, on a conversation the desk had finished with.
     *
     * A new conversation was the only way to ask this, and it arrived at the
     * desk with no history: the agent could not see what had already been
     * answered, and the resident had to explain it twice. This reopens the
     * thread instead, so the answer and the follow-up sit together.
     *
     * It goes back to Waiting rather than to the agent who closed it. That
     * agent may be off duty, and a follow-up sitting in one person's queue
     * until they next log in is slower than the new conversation it replaces.
     */
    public function followUp(ChatMessageRequest $request, string $token)
    {
        $validated = $request->validated();

        $conversation = $this->ownedConversation($token);

        if (!$conversation) {
            return $this->notFound('That conversation could not be found');
        }

        /*
         * Only a closed one is reopened. An open conversation taking this
         * route would silently reset its status and count a follow-up that
         * never happened, so it is sent down the ordinary path instead.
         */
        if ($conversation->status !== 'Closed') {
            return $this->sendMessage($request, $token);
        }

        /*
         * `closed_at` is kept, not cleared.
         *
         * The agent reading this needs to know whether the thread went quiet
         * for an hour or for a month — it changes how much of it they have to
         * read back — and `closed_at` is overwritten the next time it closes.
         */
        $conversation->update([
            'status' => 'Waiting',
            'follow_up_count' => $conversation->follow_up_count + 1,
            'reopened_at' => now(),
            'last_closed_at' => $conversation->closed_at,
            'closed_at' => null,
        ]);

        /* A line in the thread itself, so the gap is visible while reading. */
        $conversation->addMessage(
            'system',
            $conversation->last_closed_at
                ? 'The resident followed up on this conversation, closed '
                    . $conversation->last_closed_at->diffForHumans() . '.'
                : 'The resident followed up on this conversation.'
        );

        $message = $conversation->addMessage('visitor', $validated['body']);

        $this->desk->notify($conversation, $validated['body'], followUp: true);

        return $this->success([
            'conversation' => $this->views->visitor($conversation->fresh()),
            'message' => $this->views->message($message),
        ], 'Follow-up sent', 201);
    }

    /** Lets the visitor end the conversation from their side. */
    public function endConversation(string $token)
    {
        $conversation = $this->ownedConversation($token);

        if (!$conversation) {
            return $this->notFound('That conversation could not be found');
        }

        if ($conversation->status !== 'Closed') {
            $conversation->addMessage('system', 'The visitor ended the conversation.');
            $conversation->update(['status' => 'Closed', 'closed_at' => now()]);
        }

        return $this->success(null, 'Conversation closed');
    }

    /** The resident behind the request, or null for anybody else. */
    private function callerResidentId(): ?int
    {
        return auth('sanctum')->user()?->resident_id;
    }

    private function bySessionToken(string $token): ?Conversation
    {
        return Conversation::where('session_token', $token)->first();
    }

    /**
     * The conversation behind a token, but only for the resident it belongs
     * to.
     *
     * The token used to be the whole key, which was right when a stranger on
     * the landing page had nothing else. Now that the desk is residents only,
     * a leaked or guessed token must not be enough to read somebody's chat
     * with the barangay — those threads carry complaints and family business.
     */
    private function ownedConversation(string $token): ?Conversation
    {
        $conversation = $this->bySessionToken($token);
        $resident = $this->callerResidentId();

        return $conversation && $resident && $conversation->resident_id === $resident
            ? $conversation
            : null;
    }
}
