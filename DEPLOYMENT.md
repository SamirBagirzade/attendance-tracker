# Ubuntu/Debian Deployment

This app can run directly on an Ubuntu or Debian server with Node.js, PostgreSQL, and systemd.

## Quick Start

```bash
git clone <your-repo-url> attendance-tracker
cd attendance-tracker
chmod +x deploy.sh
./deploy.sh
```

The script installs required apt packages, installs Node.js 24 if needed, installs PostgreSQL, creates a database/user, writes `.env` if missing, runs Prisma migrations, builds the app, and creates a `systemd` service.

After it finishes:

```bash
sudo systemctl status attendance-tracker
```

Open:

```text
http://SERVER_IP:3000
```

## Default Values

If `.env` does not exist, `deploy.sh` creates one with:

```env
DATABASE_URL=postgresql://attendance:<generated-password>@localhost:5432/attendance_tracker?schema=public
AUTH_SECRET=<generated-secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<generated-password>
PORT=3000
```

The generated admin password is printed once at the end of deployment.

## Re-Deploy After Updates

```bash
git pull
./deploy.sh
```

The script will keep your existing `.env`, install/update dependencies, run migrations, rebuild, and restart the service.

## Useful Commands

```bash
sudo systemctl restart attendance-tracker
sudo systemctl stop attendance-tracker
sudo systemctl start attendance-tracker
sudo journalctl -u attendance-tracker -f
```

## Reverse Proxy

For a real domain, put Nginx or Caddy in front of port `3000` and enable HTTPS.

Example Nginx location block:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

If the app is served through HTTPS behind a reverse proxy, make sure the proxy sends:

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

Without HTTPS, login still works over direct `http://SERVER_IP:3000`, but you should use HTTPS for real users.

## Login Troubleshooting

If pressing login appears to do nothing:

1. Confirm `.env` has the credentials you are typing:

```bash
grep ADMIN_ .env
```

2. Restart the service after changing `.env`:

```bash
sudo systemctl restart attendance-tracker
```

3. Watch logs:

```bash
sudo journalctl -u attendance-tracker -f
```

Browser console messages like `runtime.lastError: The message port closed before a response was received` are usually from a browser extension and are not the app login error.

## Manual Environment

You can create `.env` yourself before running `deploy.sh`:

```env
DATABASE_URL="postgresql://attendance:strong-password@localhost:5432/attendance_tracker?schema=public"
AUTH_SECRET="at-least-32-random-characters"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="strong-admin-password"
PORT=3000
```
