#!/usr/bin/env bash
# ==============================================================================
# Barangay Natumolan Management System - Production Deployment Script
# Target OS: Ubuntu 24.04 LTS / 22.04 LTS
# Domain: barangaynatumolan.tech
# ==============================================================================

set -e

DOMAIN="barangaynatumolan.tech"
EMAIL="gasang143x@gmail.com"
DB_NAME="barangay_natumolan"
DB_USER="natumolan_admin"
DB_PASS="Natumolan@2026!"
APP_DIR="/var/www/barangay_natumolan"

echo "=========================================================="
echo " Starting Barangay Natumolan Automated Deployment..."
echo "=========================================================="

# 1. Update system packages
echo "--> [1/8] Updating Ubuntu system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y software-properties-common curl git unzip ufw certbot python3-certbot-nginx

# 2. Add PHP repository & install PHP 8.3 + Nginx + MariaDB
echo "--> [2/8] Installing Nginx, MariaDB, and PHP 8.3..."
add-apt-repository -y ppa:ondrej/php
apt-get update -y
apt-get install -y nginx mariadb-server \
    php8.3 php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml \
    php8.3-curl php8.3-bcmath php8.3-gd php8.3-zip php8.3-intl php8.3-cli

# 3. Install Composer & Node.js 20 LTS
echo "--> [3/8] Installing Composer and Node.js LTS..."
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 4. Setup MariaDB Database & User
echo "--> [4/8] Configuring MariaDB Database ($DB_NAME)..."
systemctl start mariadb
mariadb -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mariadb -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
mariadb -e "GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';"
mariadb -e "FLUSH PRIVILEGES;"

# 5. Setup Project Directory & Clone / Update Repository
echo "--> [5/8] Setting up Application in $APP_DIR..."
mkdir -p /var/www

if [ ! -d "$APP_DIR/.git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/jims062702/Barangay_Natumolan.git "$APP_DIR"
else
    echo "Repository already exists, pulling latest main..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
fi

cd "$APP_DIR"

# 6. Configure Backend (.env)
echo "--> [6/8] Configuring Backend & Database..."
cat << 'EOF' > backend/.env
APP_NAME="Barangay Natumolan MIS"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://barangaynatumolan.tech
FRONTEND_URL=https://barangaynatumolan.tech,https://www.barangaynatumolan.tech
APP_TIMEZONE=Asia/Manila

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=barangay_natumolan
DB_USERNAME=natumolan_admin
DB_PASSWORD=Natumolan@2026!

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=.barangaynatumolan.tech

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=database

MAIL_MAILER=smtp
MAIL_SCHEME=
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=gasang143x@gmail.com
MAIL_PASSWORD=mfolzsjyyhthhxxu
MAIL_FROM_ADDRESS=gasang143x@gmail.com
MAIL_FROM_NAME="Barangay Natumolan"

CLOUDINARY_CLOUD_NAME=dwauqhrdx
CLOUDINARY_API_KEY=673695719246775
CLOUDINARY_API_SECRET=TkkOEHrQfQZYbJPLWT9fGKxzatQ
CLOUDINARY_KEY_NAME="Barangay Natumolan"
CLOUDINARY_FOLDER=barangay_natumolan
CLOUDINARY_SECURE=true
EOF

cd "$APP_DIR/backend"
composer install --no-dev --optimize-autoloader --no-interaction
php artisan key:generate --force
php artisan storage:link || true
php artisan migrate --force --seed
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 7. Build Frontend
echo "--> [7/8] Building Frontend Assets..."
cd "$APP_DIR/frontend"
cat << 'EOF' > .env.production
VITE_API_URL=/api
VITE_APP_NAME="Barangay Natumolan"
EOF

npm install
npm run build

# 8. Configure Nginx & SSL
echo "--> [8/8] Configuring Nginx Web Server..."
cat << 'EOF' > /etc/nginx/sites-available/barangaynatumolan.tech
server {
    listen 80;
    listen [::]:80;
    server_name barangaynatumolan.tech www.barangaynatumolan.tech;

    root /var/www/barangay_natumolan/frontend/dist;
    index index.html;

    client_max_body_size 50M;

    # Backend API and Laravel Endpoints
    location ~ ^/(api|sanctum|storage) {
        root /var/www/barangay_natumolan/backend/public;
        try_files $uri $uri/ /index.php?$query_string;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/run/php/php8.3-fpm.sock;
            fastcgi_param SCRIPT_FILENAME /var/www/barangay_natumolan/backend/public$fastcgi_script_name;
            include fastcgi_params;
        }
    }

    # Frontend SPA Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static frontend assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

ln -sf /etc/nginx/sites-available/barangaynatumolan.tech /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Set file permissions
chown -R www-data:www-data "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache" "$APP_DIR/frontend/dist"
chmod -R 775 "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache"

nginx -t
systemctl reload nginx

# Enable SSL via Certbot if domain resolves
echo "Attempting Let's Encrypt SSL activation..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || {
    echo "Notice: SSL certificate acquisition will be retried once DNS finishes propagating."
}

echo "=========================================================="
echo " DEPLOYMENT SUCCESSFUL!"
echo " Visit: https://barangaynatumolan.tech"
echo "=========================================================="
