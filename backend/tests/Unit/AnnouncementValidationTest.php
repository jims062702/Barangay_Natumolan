<?php

namespace Tests\Unit;

use App\Http\Requests\Content\StoreAnnouncementRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class AnnouncementValidationTest extends TestCase
{
    public function test_title_max_characters_is_80(): void
    {
        $request = new StoreAnnouncementRequest();

        // 80 chars should pass
        $validator80 = Validator::make([
            'title' => str_repeat('a', 80),
            'body' => 'Valid body content',
            'category' => 'Announcement',
        ], $request->rules(), $request->messages());
        $this->assertFalse($validator80->fails(), '80-character title should be valid');

        // 81 chars should fail
        $validator81 = Validator::make([
            'title' => str_repeat('a', 81),
            'body' => 'Valid body content',
            'category' => 'Announcement',
        ], $request->rules(), $request->messages());
        $this->assertTrue($validator81->fails(), '81-character title should fail');
        $this->assertEquals('The title must not exceed 80 characters.', $validator81->errors()->first('title'));
    }

    public function test_short_description_excerpt_max_characters_is_80(): void
    {
        $request = new StoreAnnouncementRequest();

        // 80 chars should pass
        $validator80 = Validator::make([
            'title' => 'Valid Title',
            'excerpt' => str_repeat('b', 80),
            'body' => 'Valid body content',
            'category' => 'Announcement',
        ], $request->rules(), $request->messages());
        $this->assertFalse($validator80->fails(), '80-character excerpt should be valid');

        // 81 chars should fail
        $validator81 = Validator::make([
            'title' => 'Valid Title',
            'excerpt' => str_repeat('b', 81),
            'body' => 'Valid body content',
            'category' => 'Announcement',
        ], $request->rules(), $request->messages());
        $this->assertTrue($validator81->fails(), '81-character excerpt should fail');
        $this->assertEquals('The short description must not exceed 80 characters.', $validator81->errors()->first('excerpt'));
    }

    public function test_full_details_body_max_characters_is_1000(): void
    {
        $request = new StoreAnnouncementRequest();

        // 1000 chars should pass
        $validator1000 = Validator::make([
            'title' => 'Valid Title',
            'body' => str_repeat('c', 1000),
            'category' => 'Announcement',
        ], $request->rules(), $request->messages());
        $this->assertFalse($validator1000->fails(), '1000-character body should be valid');

        // 1001 chars should fail
        $validator1001 = Validator::make([
            'title' => 'Valid Title',
            'body' => str_repeat('c', 1001),
            'category' => 'Announcement',
        ], $request->rules(), $request->messages());
        $this->assertTrue($validator1001->fails(), '1001-character body should fail');
        $this->assertEquals('The full details must not exceed 1,000 characters.', $validator1001->errors()->first('body'));
    }
}
