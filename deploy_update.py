import os
import sys
import subprocess
import tarfile
import paramiko

VPS_HOST = "77.90.8.113"
VPS_USER = "root"
VPS_PASS = "tF1rkabU5VyV2BvP5UBq"
KEY_FILE = os.path.expanduser(r"~/.ssh/id_rsa")

print("=" * 60)
print(" Barangay Natumolan - Fast Server Update")
print("=" * 60)

# 1. Build Frontend
print("\n[1/3] Building frontend...")
res = subprocess.run(["npm", "--prefix", "frontend", "run", "build"], shell=True)
if res.returncode != 0:
    print("[X] Frontend build failed. Aborting update.")
    sys.exit(1)

# 2. Create update archive
print("\n[2/3] Archiving updated frontend & backend...")
archive_name = "server_update.tar.gz"
with tarfile.open(archive_name, "w:gz") as tar:
    if os.path.exists("frontend/dist"):
        tar.add("frontend/dist", arcname="frontend/dist")
    if os.path.exists("backend/app"):
        tar.add("backend/app", arcname="backend/app")
    if os.path.exists("backend/routes"):
        tar.add("backend/routes", arcname="backend/routes")
    if os.path.exists("backend/config"):
        tar.add("backend/config", arcname="backend/config")
    if os.path.exists("backend/database/migrations"):
        tar.add("backend/database/migrations", arcname="backend/database/migrations")
    if os.path.exists("backend/resources"):
        tar.add("backend/resources", arcname="backend/resources")

print(f"Archive created ({os.path.getsize(archive_name) / (1024*1024):.2f} MB)")

# 3. Connect to VPS and Apply
print(f"\n[3/3] Uploading and deploying to {VPS_HOST}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    if os.path.exists(KEY_FILE):
        ssh.connect(VPS_HOST, username=VPS_USER, key_filename=KEY_FILE, timeout=10)
    else:
        ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10)
except Exception:
    ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10)

sftp = ssh.open_sftp()
sftp.put(archive_name, f"/root/{archive_name}")
sftp.close()

if os.path.exists(archive_name):
    os.remove(archive_name)

remote_commands = """
set -e
tar -xzf /root/server_update.tar.gz -C /var/www/barangay_natumolan/
cd /var/www/barangay_natumolan/backend
php artisan migrate --force
php artisan route:clear
php artisan route:cache
php artisan config:cache
chown -R www-data:www-data /var/www/barangay_natumolan/frontend/dist /var/www/barangay_natumolan/backend/storage /var/www/barangay_natumolan/backend/bootstrap/cache
systemctl reload nginx
rm -f /root/server_update.tar.gz
echo '--- UPDATE_COMPLETE ---'
"""

stdin, stdout, stderr = ssh.exec_command(remote_commands)
output = stdout.read().decode()
error = stderr.read().decode()

if "--- UPDATE_COMPLETE ---" in output:
    print("\n" + "=" * 60)
    print(" SUCCESS! Your changes are now LIVE on:")
    print(" https://barangaynatumolan.tech")
    print("=" * 60)
else:
    print("Output:\n", output)
    if error:
        print("Errors:\n", error)

ssh.close()

