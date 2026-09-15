<?php

namespace App\Models\Chat;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;

class Message extends Model
{
    protected $table = 'chat_messages';

    protected $fillable = [
        'chat_conversation_id',
        'sender',
        'user_id',
        'body',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'chat_conversation_id');
    }

    /** The staff account that sent it (agent messages only). */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
