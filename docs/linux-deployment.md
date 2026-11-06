# Run BriefReceipt on a Linux VM

Target: Ubuntu 24.04 LTS or a comparable Debian-based VM with systemd, Git, curl and **Node.js 24 LTS**. Start with 2 GB RAM so dependency installation and builds have room. This is one private, personal instance. Scheduling and physical printer delivery are still unimplemented.

The editor remains on `127.0.0.1:5173`, reached through SSH. The separate Reminders receiver remains on `127.0.0.1:5180`, optionally reached through private Tailscale Serve. No public website, reverse proxy or app-port firewall opening is required. The editor has no login and rejects non-localhost origins; do not expose it with Tailscale Serve or a public proxy.

## Install

1. Install system-wide Node.js 24 LTS and npm using your VM's trusted package source or the [official Node download instructions](https://nodejs.org/en/download). The unit expects `/usr/bin/node`; if your system-wide binary is elsewhere, change `ExecStart` before installing the unit. A user-local nvm installation under `/home` is inaccessible to this hardened service. Confirm:

   ```sh
   /usr/bin/node --version
   npm --version
   sudo apt-get update
   sudo apt-get install -y git curl ca-certificates
   ```

2. Create the service account and checkout. Run these once; for an existing installation use the update section.

   ```sh
   sudo useradd --system --user-group --home-dir /var/lib/briefreceipt --shell /usr/sbin/nologin briefreceipt
   sudo install -d -o briefreceipt -g briefreceipt -m 0700 /var/lib/briefreceipt
   sudo install -d -o briefreceipt -g briefreceipt -m 0755 /opt/briefreceipt
   sudo -u briefreceipt git clone --branch main https://github.com/lfg-seth/BriefReceipt.git /opt/briefreceipt
   cd /opt/briefreceipt
   sudo -u briefreceipt env npm_config_cache=/var/lib/briefreceipt/npm-cache npm ci --include=dev
   sudo -u briefreceipt npm test
   sudo -u briefreceipt npm run build
   sudo -u briefreceipt npm run test:production
   ```

   Install dev dependencies even for production: `tsx` runs the TypeScript server, and Vite/TypeScript build the client. The systemd sandbox makes the checkout read-only while the service runs; deployment commands run outside that sandbox.

3. If migrating an existing installation, stop the desktop app and migrate its state **before starting the VM app**, as below. Otherwise connect your accounts in the VM editor after starting it; connection forms create `/var/lib/briefreceipt/.env` automatically.

4. Install and start the service:

   ```sh
   sudo install -m 0644 deploy/briefreceipt.service /etc/systemd/system/briefreceipt.service
   sudo systemd-analyze verify /etc/systemd/system/briefreceipt.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now briefreceipt
   sudo systemctl status briefreceipt --no-pager
   curl --fail http://127.0.0.1:5173/api/health
   curl --fail http://127.0.0.1:5180/health
   ```

   The first response must report `"mode":"production"`; the second identifies the Reminders upload service. Logs: `sudo journalctl -u briefreceipt -n 100 --no-pager`. `Restart=on-failure` recovers crashes and `enable` starts the app on boot. One service instance owns the persistent AI budget ledger.

## Open the editor from your computer

Run this on your computer, replacing the SSH user and VM hostname:

```sh
ssh -N -L 127.0.0.1:5173:127.0.0.1:5173 user@vm-host
```

Keep the connection open and visit **http://localhost:5173**. Stop the desktop copy first so port 5173 is free. Preserve that URL when migrating: browser settings are stored under the origin, and another port or browser starts with separate settings. The VM never receives browser settings automatically. Export settings as a backup; there is no import UI yet.

For a temporary alternate port, use `-L 127.0.0.1:5174:127.0.0.1:5173` and visit `http://localhost:5174`. The Host/Origin checks support this, but settings will be separate. Restrict VM SSH access to your trusted network or tailnet. Neither 5173 nor 5180 needs an inbound firewall rule.

## Migrate credentials, AI accounting and Reminders

Keep both app instances stopped during migration. The local AI ledger must move with the app so restarting on a fresh machine does not reset this month's reservations. Copy these private files over SSH, never through GitHub:

| Desktop file | VM destination |
| --- | --- |
| `.env` | `/var/lib/briefreceipt/.env` |
| `.local/ai/state.json` | `/var/lib/briefreceipt/ai/state.json` |
| `.local/reminders/state.json` | `/var/lib/briefreceipt/reminders/state.json` |

Skip files that do not exist. To transfer from PowerShell, create a private staging folder on the VM first, then send the files from the project directory:

```powershell
ssh user@vm-host 'umask 077; mkdir -p ~/briefreceipt-migration'
scp .env user@vm-host:briefreceipt-migration/credentials.env
scp .local/ai/state.json user@vm-host:briefreceipt-migration/ai.json
scp .local/reminders/state.json user@vm-host:briefreceipt-migration/reminders.json
```

On the VM, install each existing staged file (omit the corresponding command for any skipped source):

```sh
sudo systemctl stop briefreceipt  # only if already installed
sudo install -d -o briefreceipt -g briefreceipt -m 0700 /var/lib/briefreceipt/ai /var/lib/briefreceipt/reminders
sudo install -o briefreceipt -g briefreceipt -m 0600 ~/briefreceipt-migration/credentials.env /var/lib/briefreceipt/.env
sudo install -o briefreceipt -g briefreceipt -m 0600 ~/briefreceipt-migration/ai.json /var/lib/briefreceipt/ai/state.json
sudo install -o briefreceipt -g briefreceipt -m 0600 ~/briefreceipt-migration/reminders.json /var/lib/briefreceipt/reminders/state.json
```

Remove the three staged files after confirming the VM connections work. Do not run the desktop and VM copies together against separate copies of the AI ledger. Credentials, summaries and Reminders snapshots remain plaintext files protected by service ownership and mode 0700/0600; include `/var/lib/briefreceipt` in your private VM backups. Stop the service during a file-level backup to take a consistent snapshot. Restore ownership and permissions before restarting. Browser settings need their own export backup.

`RECEIPT_DATA_DIR` redirects all server state and the credentials file. Without it, local development retains `.env` and `.local/` in the project directory. Connection forms read and atomically rewrite the credentials file directly; it is intentionally not a systemd `EnvironmentFile`.

## Move iPhone uploads to the VM

Install and connect [Tailscale on Linux](https://tailscale.com/download/linux) to the same tailnet as the iPhone. Inspect existing Serve listeners first, then select an unused HTTPS port:

```sh
sudo tailscale serve status
sudo tailscale serve --bg --https=8443 http://127.0.0.1:5180
sudo tailscale serve status
```

Use **Serve**, which is private to the tailnet, following [Tailscale's CLI documentation](https://tailscale.com/docs/reference/tailscale-cli/serve). Save the VM's HTTPS address in Tasks and update the iPhone Shortcut's upload URL. A migrated Reminders state file preserves the existing token hash, so the phone can retain its authorization value. If that file was not migrated, create a new token and update the phone's authorization too. A new token revokes the old one. Keep Tailscale connected and Tailscale DNS enabled on the iPhone.

Run the Shortcut manually and confirm the VM editor receives the snapshot. Once the VM path works, remove the old desktop Serve mapping with `tailscale serve --https=8443 off` **on the old desktop only**. Snapshots expire after two hours, so the phone automation must still run regularly. No scheduled printing or printer transport is introduced by this deployment.

## Update and roll back

Updates briefly stop this single instance. Back up `/var/lib/briefreceipt` first; record the current commit for rollback. Run on the VM:

```sh
cd /opt/briefreceipt
git rev-parse HEAD  # keep this hash
sudo systemctl stop briefreceipt
sudo -u briefreceipt git pull --ff-only origin main
sudo -u briefreceipt env npm_config_cache=/var/lib/briefreceipt/npm-cache npm ci --include=dev
sudo -u briefreceipt npm test
sudo -u briefreceipt npm run build
sudo -u briefreceipt npm run test:production
sudo install -m 0644 deploy/briefreceipt.service /etc/systemd/system/briefreceipt.service
sudo systemd-analyze verify /etc/systemd/system/briefreceipt.service
sudo systemctl daemon-reload
sudo systemctl start briefreceipt
curl --fail http://127.0.0.1:5173/api/health
curl --fail http://127.0.0.1:5180/health
```

Stop if any command fails. To roll back the application, keep the service stopped, run `sudo -u briefreceipt git switch --detach <previous-commit>`, then repeat dependency install, build, production smoke, unit install and start. Persistent state stays outside the checkout; future releases with state migrations may also need their matching backup. To return to updates later, switch back with `sudo -u briefreceipt git switch main` before pulling.

## Verification scope

GitHub Actions runs unit tests, the production build, an isolated production smoke check and Chromium UI tests on Linux/Node 24. The smoke check verifies built asset serving, both listeners, rejected cross-origin administration, receiver isolation, unauthorized uploads and state writes under `RECEIPT_DATA_DIR`, without real credentials or provider calls. The service file and actual Tailscale/iPhone connectivity still need validation on the target VM. The systemd filesystem and state-directory settings follow the [systemd execution documentation](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html); Node's [release table](https://nodejs.org/en/about/previous-releases) identifies supported LTS versions.
