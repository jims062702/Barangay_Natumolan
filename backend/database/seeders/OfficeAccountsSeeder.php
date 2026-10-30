<?php

namespace Database\Seeders;

use App\Models\Account\User;
use Illuminate\Database\Seeder;

/**
 * The nine accounts and nothing else.
 *
 * DatabaseSeeder builds a whole demonstration barangay — households,
 * residents, certificates, cases, chat threads — which is right for showing
 * the system and wrong for handing it over. This is the other seeder: the
 * offices can sign in, and every register is empty and waiting for real
 * entries.
 *
 *     php artisan migrate:fresh --seed --seeder=Database\Seeders\OfficeAccountsSeeder
 *
 * The list is copied from DatabaseSeeder rather than shared with it, and
 * deliberately: that one is free to grow demonstration staff without those
 * people appearing on a live barangay's account screen.
 */
class OfficeAccountsSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['Hon. Rafael P. Vidal', 'pb@natumolan.local', 'Punong Barangay', 'Main Office'],
            ['Grace G. Galola', 'secretary@natumolan.local', 'Secretary', 'Main Office'],
            ['June A. Cavan', 'clerk@natumolan.local', 'Clerk', 'Main Office'],
            ['Charmil G. Manto', 'clerk2@natumolan.local', 'Clerk', 'Main Office'],
            ['Gina Caayaman', 'vawc@natumolan.local', 'VAWC Officer', 'VAWC'],
            ['Maria Faye C. Ordiz', 'lupon@natumolan.local', 'Lupon Secretary', 'Lupon'],
            ['Abbess Kristel P. Pacaldo', 'population@natumolan.local', 'Population Worker', 'Population'],
            ['Rosa F. Moreno', 'health@natumolan.local', 'Health Personnel', 'Health Station'],
            ['System Administrator', 'admin@natumolan.local', 'Admin', 'Admin'],
        ];

        foreach ($rows as [$name, $email, $role, $office]) {
            /*
             * updateOrCreate, so running this on an existing database tops up
             * a missing office rather than colliding on the unique email.
             */
            User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => 'password',
                    'role' => $role,
                    'office' => $office,
                    'is_active' => true,
                    /*
                     * Activated on creation. The emailed code proves a mailbox
                     * belongs to its owner, and a staff account is issued by
                     * hand to somebody standing in the office — the counter
                     * has already proved it.
                     */
                    'activated_at' => now(),
                ],
            );
        }

        $this->command?->warn(
            'Every account has the password "password". Change all nine before this is used for real.'
        );
    }
}
