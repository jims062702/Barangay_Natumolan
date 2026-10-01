<?php

namespace App\Http\Controllers\Api\Chat;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Chat\ChatMessageRequest;
use App\Models\Account\Notification;
use App\Models\Chat\Conversation;
use App\Services\Chat\ConversationViews;
use App\Services\Chat\IdleConversations;
use App\Services\Chat\Shortcuts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The live desk: the Barangay Clerk's side of the chat. Nobody else staffs
 * it (routes/api/chat-desk.php).
 *
 * AS MANY CONVERSATIONS AT ONCE AS COME IN (2026-09-30). It was one at a
 * time, and a resident with a two-line question waited behind somebody else's
 * long one while the Clerk sat between replies. Now the Clerk takes whoever
 * is waiting, answers each in turn, and moves between them; what stays is
 * that a conversation is one staff member's — should a second Clerk account
 * ever be made, two people answering the same resident would contradict each
 * other.
 *
 * THREE STATES, AND THE DESK'S THREE LISTS ARE THEM: Waiting (nobody has
 * accepted it yet), Active — "Open" on the page — and Closed.
 */
class DeskController extends BaseController
{
    public function __construct(private readonly ConversationViews $views)
    {
    }

    /**
     * The canned answers the desk can drop into a reply.
     *
     * Read from the same service guides and roster the public website
     * uses, so a correction made once is a correction everywhere — and
     * the Clerk never retypes a requirement from memory.
     */
    public function shortcuts(): JsonResponse
    {
        return $this->success(Shortcuts::all(), 'Shortcuts retrieved');
    }

    /**
     * One of the desk's three lists: Waiting (not accepted yet), Active (the
     * page calls it Open) or Closed. Nothing else — the lists do not overlap,
     * so a conversation is in exactly one of them.
     */
    public function conversations(Request $request)
    {
        /* A conversation the resident walked away from closes first — see IdleConversations. */
        IdleConversations::sweep();

        $status = $request->input('status', 'Waiting');

        if (! in_array($status, ['Waiting', 'Active', 'Closed'], true)) {
            return $this->error('Unknown list. Choose Waiting, Active or Closed.', 422);
        }

        $query = Conversation::with('resident:id,first_name,middle_name,last_name,suffix,zone_purok', 'agent:id,name')
            ->where('status', $status);

        $conversations = ($status === 'Closed'
            /* The one closed a minute ago is the one looked for: newest first. */
            ? $query->orderByDesc('closed_at')->orderByDesc('id')
            /*
             * Oldest ARRIVAL first — the same order the resident is shown as
             * their queue number. Ranking on the last message instead would
             * move somebody down the list for sending a follow-up, and then
             * the number they were quoted would be a lie.
             */
            : $query->orderBy('created_at')->orderBy('id')
        )->paginate(20);

        $conversations->getCollection()->transform(fn ($c) => $this->views->agent($c));

        return $this->success($conversations, 'Conversations retrieved');
    }

    /**
     * The counts on the desk's tabs, and what the desk rings for.
     *
     * `unread` is the resident lines waiting in THIS Clerk's open
     * conversations, less the one on screen (`except`) — that one is being
     * read as it arrives, and ringing for it would ring at every line.
     */
    public function waitingCount(Request $request)
    {
        IdleConversations::sweep();

        $onScreen = $request->integer('except');

        return $this->success([
            'waiting' => Conversation::where('status', 'Waiting')->count(),
            'open' => Conversation::where('status', 'Active')->count(),
            // SUM() comes back as a string from MySQL; the page wants a number.
            'unread' => (int) Conversation::where('status', 'Active')
                ->where('assigned_to', auth()->id())
                ->when($onScreen > 0, fn ($q) => $q->whereKeyNot($onScreen))
                ->sum('unread_for_agent'),
        ], 'Live chat queue');
    }

    public function show(Conversation $conversation)
    {
        $conversation->load('resident', 'agent:id,name');

        // Opening the thread clears the agent's unread badge for it.
        $conversation->forceFill(['unread_for_agent' => 0])->save();

        return $this->success([
            'conversation' => $this->views->agent($conversation),
            'messages' => $conversation->messages()->with('user:id,name,role')->get()
                ->map(fn ($m) => $this->views->message($m)),
        ], 'Conversation retrieved');
    }

    /**
     * The Clerk accepts a waiting conversation: it becomes theirs, and Open.
     *
     * A WAITING conversation is anybody's to accept — a new one, or one a
     * follow-up reopened, which still names whoever answered it before. Only
     * an Active one belongs to somebody.
     */
    public function claim(Conversation $conversation)
    {
        if ($conversation->status === 'Closed') {
            return $this->error('This conversation is already closed', 409);
        }

        if ($this->heldByAnother($conversation)) {
            return $this->error(
                'This conversation is already being handled by ' . ($conversation->agent?->name ?? 'another staff member') . '.',
                409
            );
        }

        /* Accepted already, by this Clerk: a second press says so, once. */
        if ($conversation->status === 'Active') {
            return $this->success($this->views->agent($conversation), 'You are already handling this conversation');
        }

        $conversation->update([
            'status' => 'Active',
            'assigned_to' => auth()->id(),
            'claimed_at' => $conversation->claimed_at ?? now(),
        ]);

        $conversation->addMessage(
            'system',
            auth()->user()->name . ' (' . auth()->user()->role . ') has joined the conversation.'
        );

        return $this->success($this->views->agent($conversation->fresh()), 'You are now handling this conversation');
    }

    public function reply(ChatMessageRequest $request, Conversation $conversation)
    {
        $validated = $request->validated();

        if ($conversation->status === 'Closed') {
            return $this->error('This conversation is closed', 409);
        }

        /* One staff member to a conversation: two people answering the same
           resident would contradict each other. */
        if ($this->heldByAnother($conversation)) {
            return $this->error(
                'This conversation is being handled by ' . ($conversation->agent?->name ?? 'another staff member') . '.',
                409
            );
        }

        /*
         * Replying IS accepting — the Clerk should never have to press Accept
         * before they can help someone.
         *
         * On STATUS, not on whether somebody is named. A follow-up reopens a
         * conversation as Waiting with its old handler still on it, and a
         * reply that only looked for "no handler" left it Waiting for good:
         * answered, yet still in the queue, with the resident still shown a
         * place in line.
         */
        if ($conversation->status === 'Waiting') {
            $conversation->update([
                'status' => 'Active',
                'assigned_to' => auth()->id(),
                'claimed_at' => $conversation->claimed_at ?? now(),
            ]);
        }

        $message = $conversation->addMessage('agent', $validated['body'], auth()->id());
        $conversation->forceFill(['unread_for_agent' => 0])->save();

        // A resident with a portal account also gets it in their notifications,
        // so an answer that lands after they close the tab is not lost.
        if ($conversation->resident_id) {
            Notification::notifyResident(
                $conversation->resident_id,
                'chat_reply',
                'Reply from the Barangay Clerk',
                $validated['body'],
                'chat',
                $conversation->id
            );
        }

        return $this->success($this->views->message($message->load('user:id,name,role')), 'Reply sent', 201);
    }

    public function close(Conversation $conversation)
    {
        if ($conversation->status === 'Closed') {
            return $this->success($this->views->agent($conversation), 'Conversation already closed');
        }

        $conversation->addMessage(
            'system',
            'The Barangay Clerk marked this conversation as resolved.'
        );
        $conversation->update(['status' => 'Closed', 'closed_at' => now()]);

        return $this->success($this->views->agent($conversation->fresh()), 'Conversation closed');
    }

    /** Open, and in another staff member's hands. A waiting one is nobody's yet. */
    private function heldByAnother(Conversation $conversation): bool
    {
        return $conversation->status === 'Active'
            && $conversation->assigned_to
            && (int) $conversation->assigned_to !== (int) auth()->id();
    }
}
