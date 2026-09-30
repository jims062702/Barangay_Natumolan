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
 * The live desk: the Barangay Clerk's side of the chat, with the Punong
 * Barangay and Admin able to step in.
 *
 * AS MANY CONVERSATIONS AT ONCE AS COME IN (2026-09-30). It was one at a
 * time, and a resident with a two-line question waited behind somebody else's
 * long one while the Clerk sat between replies. Now the Clerk takes whoever
 * is waiting, answers each in turn, and moves between them; what stays is
 * that a conversation is one staff member's — two people answering the same
 * resident would contradict each other.
 */
class DeskController extends BaseController
{
    public function __construct(private readonly ConversationViews $views)
    {
    }

    /** The live desk worklist: waiting first, then whatever is still open. */
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

    /** The live desk worklist: waiting first, then whatever is still open. */
    public function conversations(Request $request)
    {
        /* A conversation the resident walked away from closes first — see IdleConversations. */
        IdleConversations::sweep();

        $query = Conversation::with('resident:id,first_name,middle_name,last_name,suffix,zone_purok', 'agent:id,name');

        $status = $request->input('status', 'open');

        if ($status === 'open') {
            $query->whereIn('status', ['Waiting', 'Active']);
        } elseif ($status === 'mine') {
            /* The ones this staff member is in the middle of. */
            $query->where('status', 'Active')->where('assigned_to', auth()->id());
        } elseif (in_array($status, ['Waiting', 'Active', 'Closed'], true)) {
            $query->where('status', $status);
        }

        $conversations = $query
            /*
             * Waiting before Active, then oldest ARRIVAL first — the same
             * order the resident is shown as their queue number. Ranking on
             * the last message instead would move somebody down the list for
             * sending a follow-up, and then the number they were quoted would
             * be a lie.
             */
            ->orderByRaw("CASE status WHEN 'Waiting' THEN 0 WHEN 'Active' THEN 1 ELSE 2 END")
            ->orderBy('created_at')
            ->paginate(20);

        $conversations->getCollection()->transform(fn ($c) => $this->views->agent($c));

        return $this->success($conversations, 'Conversations retrieved');
    }

    /** How many people are waiting right now — for the sidebar badge. */
    public function waitingCount()
    {
        IdleConversations::sweep();

        return $this->success([
            'waiting' => Conversation::where('status', 'Waiting')->count(),
            // SUM() comes back as a string from MySQL; the badge wants a number.
            'unread' => (int) Conversation::whereIn('status', ['Waiting', 'Active'])
                ->sum('unread_for_agent'),
            // How many conversations this staff member is in the middle of.
            'mine' => Conversation::where('assigned_to', auth()->id())
                ->where('status', 'Active')
                ->count(),
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

    /** The secretary takes the conversation. */
    public function claim(Conversation $conversation)
    {
        if ($conversation->status === 'Closed') {
            return $this->error('This conversation is already closed', 409);
        }

        if ($conversation->assigned_to && $conversation->assigned_to !== auth()->id()) {
            return $this->error(
                'This conversation is already being handled by ' . ($conversation->agent?->name ?? 'another staff member') . '.',
                409
            );
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
        if ($conversation->assigned_to && $conversation->assigned_to !== auth()->id()) {
            return $this->error(
                'This conversation is being handled by ' . ($conversation->agent?->name ?? 'another staff member') . '.',
                409
            );
        }

        // Replying IS taking the conversation — an agent should never have to
        // press "claim" before they can help someone.
        if (!$conversation->assigned_to) {
            $conversation->update([
                'status' => 'Active',
                'assigned_to' => auth()->id(),
                'claimed_at' => now(),
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
}
