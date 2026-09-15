<?php

namespace App\Http\Controllers\Api\Chat;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Chat\ChatMessageRequest;
use App\Models\Account\Notification;
use App\Models\Chat\Conversation;
use App\Services\Chat\ConversationViews;
use App\Services\Chat\Shortcuts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The live desk: the Barangay Secretary's side of the chat, with the Punong
 * Barangay and Admin able to step in. One conversation at a time.
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
     * the Secretary never retypes a requirement from memory.
     */
    public function shortcuts(): JsonResponse
    {
        return $this->success(Shortcuts::all(), 'Shortcuts retrieved');
    }

    /** The live desk worklist: waiting first, then whatever is still open. */
    public function conversations(Request $request)
    {
        $query = Conversation::with('resident:id,first_name,middle_name,last_name,suffix,zone_purok', 'agent:id,name');

        $status = $request->input('status', 'open');

        if ($status === 'open') {
            $query->whereIn('status', ['Waiting', 'Active']);
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
        $mine = Conversation::where('assigned_to', auth()->id())
            ->where('status', 'Active')
            ->with('resident:id,first_name,last_name')
            ->first();

        return $this->success([
            'waiting' => Conversation::where('status', 'Waiting')->count(),
            // SUM() comes back as a string from MySQL; the badge wants a number.
            'unread' => (int) Conversation::whereIn('status', ['Waiting', 'Active'])
                ->sum('unread_for_agent'),
            // The one conversation this agent is in, so the desk can grey out
            // the rest instead of letting them be opened and then refused.
            'active_id' => $mine?->id,
            'active_with' => $mine?->visitor_name,
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

        if ($busy = $this->agentIsBusyWith($conversation)) {
            return $this->error($this->busyMessage($busy), 409);
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

        // Replying IS taking the conversation — an agent should never have to
        // press "claim" before they can help someone. It is still one at a
        // time: replying into a second thread would open it just as surely as
        // claiming it would.
        if (!$conversation->assigned_to) {
            if ($busy = $this->agentIsBusyWith($conversation)) {
                return $this->error($this->busyMessage($busy), 409);
            }

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
                'Reply from the Barangay Secretary',
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
            'The Barangay Secretary marked this conversation as resolved.'
        );
        $conversation->update(['status' => 'Closed', 'closed_at' => now()]);

        return $this->success($this->views->agent($conversation->fresh()), 'Conversation closed');
    }

    /**
     * Whoever the agent is already with, if it is not this conversation.
     *
     * The desk is one person answering one person. Two threads at once means
     * both visitors get half an answer slowly, and the queue behind them is
     * told nothing — so the register refuses rather than letting it happen.
     */
    private function agentIsBusyWith(Conversation $conversation): ?Conversation
    {
        return Conversation::where('assigned_to', auth()->id())
            ->where('status', 'Active')
            ->where('id', '!=', $conversation->id)
            ->with('resident:id,first_name,last_name')
            ->first();
    }

    /** Says who, and what to do about it. */
    private function busyMessage(Conversation $busy): string
    {
        return 'You are already in a conversation with ' . $busy->visitor_name
            . '. Close it when you are done and the next person comes through — '
            . 'the desk handles one at a time so nobody is left half-answered.';
    }
}
