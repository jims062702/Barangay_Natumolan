<?php

namespace Database\Seeders;

use App\Models\Account\User;
use App\Models\Council\Official;
use Illuminate\Database\Seeder;

/**
 * Additive seeder (safe to run on existing data): creates the SK account
 * and seeds the officials list if it is empty. Run with:
 *   php artisan db:seed --class=SkSeeder
 */
class SkSeeder extends Seeder
{
    public function run(): void
    {
        // SK Chairperson login
        User::updateOrCreate(
            ['email' => 'sk@natumolan.local'],
            [
                'name' => 'Hon. Kyla Marie D. Torres',
                'password' => 'password',
                'role' => 'SK Chairperson',
                'office' => 'SK',
                'is_active' => true,
            ]
        );

        // Seed officials once (photos can be uploaded later by the SK office).
        if (Official::count() === 0) {
            $term = '2023 – 2026';

            $barangay = [
                ['Punong Barangay', 'Hon. Rafael P. Vidal'],
                ['Barangay Kagawad', 'Hon. Angelie Quin M. Agustero'],
                ['Barangay Kagawad', 'Hon. Josephine S. Daradar'],
                ['Barangay Kagawad', 'Hon. Rosendo A. Manto'],
                ['Barangay Kagawad', 'Hon. Novelito A. Palapo'],
                ['Barangay Kagawad', 'Hon. Lamberto S. Neri'],
                ['Barangay Kagawad', 'Hon. Jocelyn A. Lim'],
                ['Barangay Kagawad', 'Hon. Marivic B. Ajon'],
                ['Barangay Secretary', 'Grace G. Galola'],
                ['Barangay Treasurer', 'Donna Lyn R. Quilang'],
            ];

            $sk = [
                ['SK Chairperson', 'Hon. Kyla Marie D. Torres'],
                ['SK Kagawad', 'Hon. John Rey M. Abella'],
                ['SK Kagawad', 'Hon. Princess Ann L. Uy'],
                ['SK Kagawad', 'Hon. Mark Joseph R. Salvador'],
                ['SK Kagawad', 'Hon. Angelica F. Bautista'],
                ['SK Kagawad', 'Hon. Carl Vincent T. Roa'],
                ['SK Kagawad', 'Hon. Shaira Mae G. Lim'],
                ['SK Kagawad', 'Hon. Daniel P. Cabrera'],
                ['SK Secretary', 'Ms. Nicole S. Enriquez'],
                ['SK Treasurer', 'Mr. Joshua K. Villar'],
            ];

            foreach ($barangay as $i => [$position, $name]) {
                Official::create([
                    'group' => 'Barangay',
                    'position' => $position,
                    'name' => $name,
                    'term' => $term,
                    'sort_order' => $i,
                    'is_active' => true,
                ]);
            }

            foreach ($sk as $i => [$position, $name]) {
                Official::create([
                    'group' => 'SK',
                    'position' => $position,
                    'name' => $name,
                    'term' => $term,
                    'sort_order' => $i,
                    'is_active' => true,
                ]);
            }
        }
    }
}
