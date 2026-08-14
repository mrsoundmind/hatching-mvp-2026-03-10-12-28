# Hatchin on Oracle Always Free + Coolify

Runbook. Verified against Oracle and Coolify docs on 7 August 2026.
Facts that expire fast are dated inline. Anything undated is structural.

---

## 0. Read this before you commit to the path

**Verified current limits (Always Free, after the 15 June 2026 cut):**

| Resource | Limit |
|---|---|
| Ampere A1 | 2 OCPU / 12 GB, total across all A1 instances |
| A1 quota | 1,500 OCPU-hours + 9,000 GB-hours per month |
| Block storage | 200 GB total (boot + block), home region only |
| Volume backups | 5 |
| Outbound transfer | 10 TB / month |
| Object Storage | 20 GB + 50,000 API requests / month |
| Load balancer | 10 Mbps flexible LB |

2 OCPU / 12 GB is exactly the whole free A1 allowance. There is no headroom
for a second instance, a staging box, or a build runner. One machine.

**Oracle cut this in half with no announcement.** No blog post, no email. The
docs changed and people found out when instances stopped. Design assuming it
can happen again.

**Two findings specific to your repo:**

1. **You have no Dockerfile and no docker-compose.** `fly.toml` has an empty
   `[build]` block, so Fly is using Nixpacks auto-detection. There is no
   existing image list to audit for arm64. Section 6 gives you a Dockerfile,
   because "whatever Nixpacks picks" is not something you want to debug on a
   2-core ARM box.
2. **You are already on Fly at roughly $0 to $3 a month (₹0 to ₹258).**
   `min_machines_running = 0`. This move does not save meaningful money
   against your actual current spend, only against the Hetzner spend you were
   planning. It buys you a bigger box and costs you ops work. Decide with that
   framing, not "free vs paid".

---

## 1. Pre-flight: does India have A1 capacity?

A1 capacity in India is the single thing that decides whether this path
exists. Community reports say **ap-hyderabad-1 does not allocate A1 at all**;
Mumbai is intermittent. Prove it before you build anything on the assumption.

**Your home region is permanent.** It is chosen at signup and cannot be
changed. If you pick wrong you start a new tenancy with a different email.

### 1.1 Create the account

Sign up at <https://signup.cloud.oracle.com>. Pick **India South (Mumbai)**
as home region, not Hyderabad.

A credit card is required for identity verification. Oracle places a
temporary hold of about $1 (₹86) and reverses it. You are not charged, and
an Always Free account cannot incur charges without you explicitly upgrading.

### 1.2 Probe capacity from the CLI, not the console

The console hides which availability domain failed. The CLI does not.

```bash
# install the OCI CLI (standard, documented)
# https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"
oci setup config          # walks you through API key + tenancy OCID

# what ADs exist in your home region
oci iam availability-domain list --output table

# the actual probe: try to launch the smallest A1 in each AD.
# Out of host capacity comes back immediately. This costs nothing if it fails.
oci compute instance launch \
  --availability-domain "<AD-1-name>" \
  --compartment-id "<your-tenancy-ocid>" \
  --shape VM.Standard.A1.Flex \
  --shape-config '{"ocpus":1,"memoryInGBs":6}' \
  --image-id "<ubuntu-24.04-aarch64-ocid>" \
  --subnet-id "<subnet-ocid>" \
  --assign-public-ip true \
  --display-name capacity-probe \
  --wait-for-state RUNNING
```

Get the image OCID with:

```bash
oci compute image list --compartment-id "<tenancy-ocid>" \
  --operating-system "Canonical Ubuntu" --operating-system-version "24.04" \
  --shape VM.Standard.A1.Flex --output table
```

**Read the result:**

| Response | Meaning | Do |
|---|---|---|
| `RUNNING` | capacity exists right now | terminate the probe, continue to §2 |
| `Out of host capacity` | none in that AD | try the next AD |
| all ADs out | Mumbai has nothing today | §1.3 |
| `LimitExceeded` | quota, not capacity | you already have A1 running somewhere |

### 1.3 If every AD is out of capacity

Capacity is released in bursts as others release instances. Two options, and
be honest with yourself about which you are willing to do:

**Option A: poll for it.** A cron that retries the launch every few minutes.
The well-known implementation is
<https://github.com/oeufmeister/oci-arm-host-capacity>. Expect hours to
weeks. Do not poll faster than every 60 seconds; Oracle rate-limits and
aggressive polling has been reported to get accounts flagged.

**Option B: stop here.** If you need this deployed this week, Oracle Free is
not the path. Your realistic alternatives at this size:

| | Cost / month | Notes |
|---|---|---|
| Stay on Fly | ~$0 to $3 (₹0 to ₹258) | already working, already deployed |
| Hetzner CAX11 (ARM, 2 vCPU / 4 GB) | ~€3.79 (~$4.10 / ₹353) | Coolify runs fine, no capacity lottery |
| Hetzner CAX21 (4 vCPU / 8 GB) | ~€6.49 (~$7 / ₹602) | comfortable for build + Postgres + Coolify |

**Do not skip §1 and hope.** Provisioning the network first and discovering
there is no capacity is the most common way this wastes an afternoon.

---

## 2. Instance provisioning

Once a probe succeeds, terminate it and launch the real one.

- **Shape:** `VM.Standard.A1.Flex`, **2 OCPU / 12 GB** (your whole allowance)
- **Image:** Canonical Ubuntu 24.04, **aarch64** build
- **Boot volume:** 150 GB. You get 200 GB total; leave ~50 GB spare so you can
  attach a separate volume later without rebuilding. Set boot volume
  performance to **Balanced**, not Lower Cost, or Postgres will crawl.
- **SSH key:** paste your public key at create time. There is no password
  fallback on Oracle images.
- Assign a public IPv4.

Then reserve the IP so it survives a stop/start:

```bash
# Console: Networking > IP Management > Reserved public IPs > assign to the VNIC
# An ephemeral IP changes on stop/start and will break your DNS silently.
```

---

## 3. Networking: both layers

This is the step that catches everyone. Oracle has **two** firewalls and
opening one does nothing on its own.

### 3.1 Layer 1: the VCN Security List (Oracle's edge)

Console: Networking > VCN > your subnet > Security List > Add Ingress Rules.

| Source | Protocol | Port | Why |
|---|---|---|---|
| 0.0.0.0/0 | TCP | 80 | HTTP, needed for ACME HTTP-01 |
| 0.0.0.0/0 | TCP | 443 | HTTPS |
| `<your.ip>/32` | TCP | 22 | SSH. Do not leave this at 0.0.0.0/0 |

Coolify's dashboard runs on 8000. **Do not open 8000 to the world.** Reach it
over an SSH tunnel (§5.3) or put it behind a hostname with auth.

### 3.2 Layer 2: the instance iptables (the one people miss)

Oracle's Ubuntu images ship with a populated iptables ruleset that **rejects**
inbound traffic, including on ports you just opened at the edge. You will see
a connection timeout and blame the Security List.

```bash
ssh ubuntu@<your-ip>

# see the REJECT rules that are eating your traffic
sudo iptables -L INPUT -n --line-numbers

# insert accepts ABOVE the catch-all reject (position matters)
sudo iptables -I INPUT 6 -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT 7 -p tcp --dport 443 -j ACCEPT

# persist across reboot, or you lose this on the next restart
sudo apt-get update && sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

Check `iptables -L INPUT -n --line-numbers` output first: the position `6`
above assumes the default Oracle ruleset. **Insert above the
`REJECT all -- 0.0.0.0/0` line**, whatever number that actually is. Appending
with `-A` puts your rule after the reject and does nothing.

Verify from your laptop before continuing:

```bash
nc -zv <your-ip> 80 && nc -zv <your-ip> 443
```

If that fails, the problem is one of these two layers. Do not install Coolify
until it passes.

---

## 4. Anti-reclamation

Oracle reclaims Always Free instances when, over a **7-day window**, all of
these are true:

- CPU 95th percentile < 20%
- Network utilisation < 20%
- Memory utilisation < 20% (A1 shapes only)

**They are ANDed.** You only need to break one. Memory is the cheap one to
break and the one that does not distort your metrics or burn CPU you might
want.

Coolify (~600 MB to 1 GB) plus Postgres plus your Node API will typically hold
memory above 20% of 12 GB (2.4 GB) on its own. Verify rather than assume:

```bash
free -m   # want "used" comfortably above 2400
```

If you are under, reserve a floor rather than running a CPU burner:

```bash
# a 1 GB tmpfs holding a file: costs no CPU, survives as real memory use
sudo mkdir -p /var/keepalive
echo 'tmpfs /var/keepalive tmpfs size=1G 0 0' | sudo tee -a /etc/fstab
sudo mount /var/keepalive
sudo dd if=/dev/zero of=/var/keepalive/ballast bs=1M count=900
```

Avoid the common advice to run a CPU stress loop. It works, but on a 2 OCPU
box you are burning half your compute budget to keep a free VM, and it makes
real CPU alerts meaningless.

**Also:** set a billing alert at $1 (₹86) even on Always Free. It is your only
early warning that something drifted into a paid resource.

---

## 5. Coolify

Requirements: 2 CPU / 2 GB RAM / 30 GB disk minimum. Coolify's installer
supports arm64 natively, so nothing special is needed here.

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Official docs: <https://coolify.io/docs/get-started/installation>

That script is standard and well documented; I am not going to reproduce what
it does. The Oracle-specific parts are:

**5.1** It installs Docker. Confirm you got the arm64 daemon:

```bash
docker version --format '{{.Server.Arch}}'   # expect arm64
```

**5.2** Give Docker a log cap. A 150 GB disk fills faster than you expect and
a full disk takes Postgres down hard.

```bash
sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
sudo systemctl restart docker
```

**5.3** Reach the dashboard without exposing 8000:

```bash
ssh -L 8000:localhost:8000 ubuntu@<your-ip>
# then open http://localhost:8000
```

Create the admin user on first load. Do this immediately: the first account to
register becomes the admin.

---

## 6. Deploying Hatchin

### 6.1 arm64 audit of your actual stack

You asked me to flag images without arm64 builds. **You have no Dockerfile and
no docker-compose to audit.** Here is the audit of what you will be running:

| Image / package | arm64? | Note |
|---|---|---|
| `node:22-alpine` | yes | official multi-arch |
| `postgres:17-alpine` | yes | official multi-arch |
| `ghcr.io/coollabsio/coolify` | yes | installer supports arm64 |
| `esbuild` | yes | publishes `@esbuild/linux-arm64` |
| `pdfkit`, `pdf-parse` | yes | pure JS, no native build |
| **`@playwright/test`** | **problem** | Playwright does not ship Chromium builds for all arm64 Linux targets. It is a **devDependency**. Install with `--omit=dev` in the image and it never matters. If it ends up in the production install, the image build fails on `playwright install`. |

You have no `sharp`, `canvas`, `bcrypt`, `node-gyp` or `better-sqlite3`, which
is what usually breaks an arm64 port. This stack is unusually clean.

### 6.2 The Dockerfile

Add this at repo root. Multi-stage so the toolchain does not ship, and
`--omit=dev` keeps Playwright out of the runtime layer.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/shared ./shared
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

And a `.dockerignore`, or you will ship your `node_modules` and every
screenshot in the repo root into the build context:

```
node_modules
dist
.git
tests
test-results
playwright-report
.playwright-mcp
*.png
.env*
```

### 6.3 Build where there is RAM

**Do not build on the box.** `vite build` on 2 ARM cores with Postgres and
Coolify already resident is the single most likely thing to OOM this
deployment. Your client build already warns about chunks over 500 kB, and Vite
peaks well above its steady-state usage.

Two options, in order of preference:

1. **Build in GitHub Actions on arm64, push to GHCR, have Coolify pull the
   image.** Coolify supports deploying a prebuilt image. Your box then only
   ever pulls and runs.
2. **Build on the box with swap.** If you must:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Swap on a Balanced boot volume is slow but it turns an OOM kill into a slow
build, which is the trade you want.

### 6.4 Postgres

Coolify one-click Postgres, or a service in your stack. Pin `postgres:17-alpine`.

You are moving off Supabase, so two things in your codebase matter:

- `server/db.ts` uses `pg` (node-postgres). Self-hosted Postgres works
  directly; you can drop the Supavisor session-mode workaround entirely.
- `pg-boss` needed session mode on Supavisor. Against a direct Postgres
  connection that constraint disappears. The `query_timeout` and keepAlive
  hardening in `jobQueue.ts` is still worth keeping.

Tune for a shared 12 GB box. Postgres defaults assume it owns the machine:

```
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 16MB
maintenance_work_mem = 256MB
max_connections = 50
```

`max_connections = 50` matters: you hit Supabase's 15-connection pooler ceiling
during this project and it took down static asset delivery, because the session
store runs on every request. Do not recreate that.

### 6.5 What to expect under load, and where it breaks

Steady state on 2 OCPU / 12 GB:

| | RAM | CPU |
|---|---|---|
| Coolify + Docker daemon | 0.8 to 1.2 GB | low |
| Postgres (tuned above) | 1.5 to 2.5 GB | low, spikes on query |
| Node API | 0.4 to 0.8 GB | 1 core under chat load |
| **Headroom** | **~7 GB** | **~1 core** |

That is comfortable. **It breaks in three places:**

1. **Build concurrent with traffic.** Vite build wants 2 to 3 GB and both
   cores. Serving degrades badly during a build. §6.3 fixes this.
2. **LLM streaming concurrency.** Your WS streaming holds a connection per
   active chat. 2 OCPUs handles maybe 30 to 50 concurrent streams before
   event-loop latency becomes visible. The LLM calls are outbound and mostly
   waiting, so this is higher than it sounds, but it is not elastic. There is
   no second machine to scale to.
3. **Disk.** 150 GB with Docker images, build cache, Postgres and logs.
   Prune weekly: `docker system prune -af --filter "until=168h"`.

---

## 7. Domain and TLS

Coolify bundles Caddy and does ACME for you. Standard and documented:
<https://coolify.io/docs/knowledge-base/dns-configuration>

Oracle-specific: TLS issuance **will fail silently** if §3.2 iptables is wrong,
because ACME HTTP-01 needs inbound port 80 and Oracle blocks it at the
instance level. If certificates do not issue, check iptables before you touch
anything in Coolify.

Point an A record at your **reserved** IP, not the ephemeral one.

---

## 8. Backups

Free tier has no backups. This is the part you cannot skip: everything lives on
one boot volume on a machine Oracle can reclaim.

**Target: Cloudflare R2.** Free tier is 10 GB storage and, critically, **zero
egress fees**, so a restore costs nothing. Backblaze B2 works too (10 GB free)
but charges egress beyond a threshold.

```bash
sudo apt-get install -y postgresql-client-16 restic
# or use rclone; both have arm64 builds
```

```bash
sudo tee /usr/local/bin/pg-backup.sh >/dev/null <<'SH'
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/tmp/hatchin-${STAMP}.sql.gz

docker exec "$PG_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDATABASE" \
  | gzip -9 > "$OUT"

# verify the dump is not silently empty before shipping it
test "$(stat -c%s "$OUT")" -gt 5000 || { echo "dump suspiciously small"; exit 1; }

rclone copy "$OUT" "r2:hatchin-backups/"
rm -f "$OUT"

# keep 30 days remotely
rclone delete --min-age 30d "r2:hatchin-backups/"
SH
sudo chmod +x /usr/local/bin/pg-backup.sh
```

```bash
# 02:30 UTC daily
echo '30 2 * * * root /usr/local/bin/pg-backup.sh >> /var/log/pg-backup.log 2>&1' \
  | sudo tee /etc/cron.d/pg-backup
```

**Test the restore now, not after you need it.** A backup you have never
restored is not a backup:

```bash
gunzip -c hatchin-<stamp>.sql.gz | docker exec -i <pg> psql -U postgres -d restore_test
```

Also enable Oracle's own **boot volume backup policy** (Bronze, weekly). You
get 5 free volume backups and it is a different failure domain from your
pg_dumps.

---

## 9. Failure table

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | Site times out. Security List looks correct. | Instance iptables rejects 80/443. Oracle's images ship a REJECT ruleset that the edge Security List does not override. | §3.2. Insert ACCEPT **above** the REJECT line, then `netfilter-persistent save`. |
| 2 | `Out of host capacity` on launch, possibly for weeks. | A1 demand in India. Hyderabad reportedly allocates no A1 at all. | §1.3. Poll, or move to Hetzner. Not solvable from your side. |
| 3 | Deploy hangs then the box becomes unreachable; container is `Exited (137)`. | OOM during `vite build`. 137 = SIGKILL from the OOM killer. Postgres often dies alongside it. | Build off-box (§6.3), or add 4 GB swap. Confirm with `dmesg -T \| grep -i oom`. |
| 4 | Instance disappears; Oracle emails after the fact. | Idle reclamation: CPU, network **and** memory all under 20% for 7 days. | §4. Break one condition, memory is cheapest. Recovery is a full rebuild from §2, which is why §8 exists. |
| 5 | TLS never issues; Caddy retries forever. | ACME HTTP-01 cannot reach port 80. Same root cause as #1, or DNS pointed at the old ephemeral IP after a stop/start. | Verify `nc -zv <ip> 80` from outside, and that the A record matches the **reserved** IP. |

Honourable mention: disk full at 150 GB from Docker layers and logs. Symptom is
Postgres refusing writes. Prevented by §5.2 and weekly pruning.

---

## 10. Exit plan

The premise of this deployment is that Oracle can take it away. They halved the
tier in June 2026 without telling anyone, and the reclamation policy is
explicit. Assume you will leave.

**What keeps the exit cheap:** everything is a Docker image plus a Postgres
dump. Neither is Oracle-specific. Do not use OCI Object Storage as your
application store, do not use OCI Vault for secrets, do not use their managed
load balancer as anything but a passthrough. If you keep those three rules the
migration is a DNS change and a restore.

**Migration paths, realistic timings:**

| Trigger | Destination | Time | Data loss |
|---|---|---|---|
| Instance reclaimed | new Oracle A1, same steps | 2 to 4 hours, plus capacity wait | up to 24h (last nightly dump) |
| Tier cut again | Hetzner CAX21, ~€6.49/mo (~$7 / ₹602) | 1 to 2 hours | none if planned |
| Need to move now | back to Fly | 20 to 30 minutes | none |

That last row is worth sitting with. **Your Fly deployment already exists and
works.** Keeping `fly.toml` in the repo and the app provisioned but scaled to
zero costs approximately nothing and makes your disaster recovery a
`flyctl deploy`. I would not delete it.

**Rehearse once.** Restore last night's dump into a local Postgres and boot the
app against it. An untested exit plan is a wish.

---

## Sources

- Oracle, Always Free resource limits: <https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm>
- Oracle, idle reclamation: <https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm>
- InfoQ on the unannounced June 2026 cut: <https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/>
- Linuxiac: <https://linuxiac.com/oracle-quietly-cuts-free-tier-ampere-a1-resources-in-half/>
- Coolify installation: <https://coolify.io/docs/get-started/installation>
- A1 capacity workaround: <https://github.com/oeufmeister/oci-arm-host-capacity>
