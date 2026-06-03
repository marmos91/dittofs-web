---
title: Getting Started
description: Install the DittoFS server and mount your first share over NFS.
sidebar:
  order: 1
---

This guide gets a DittoFS server running and an NFS share mounted in a few
minutes.

## Install

Pick whichever fits your platform.

### Nix (recommended)

```bash
# Run directly without installing
nix run github:marmos91/dittofs -- init
nix run github:marmos91/dittofs -- start

# Or install both dfs (server) and dfsctl (client) to your profile
nix profile install github:marmos91/dittofs
dfs init && dfs start
```

### Quick install (macOS / Linux)

```bash
curl -fsSL https://github.com/marmos91/dittofs/releases/latest/download/install.sh | sh
```

### Homebrew

```bash
brew tap marmos91/tap
brew install marmos91/tap/dfs      # server daemon
brew install marmos91/tap/dfsctl   # client CLI
```

### Debian / Ubuntu (APT)

```bash
curl -fsSL https://s3.cubbit.eu/dittofs-binaries/apt/dittofs.gpg.key | gpg --dearmor --yes | sudo tee /usr/share/keyrings/dittofs.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/dittofs.gpg] https://s3.cubbit.eu/dittofs-binaries/apt stable main" | sudo tee /etc/apt/sources.list.d/dfs.list
sudo apt update && sudo apt install dfs
sudo systemctl enable --now dfs
```

### Docker

```bash
docker run -d \
  -p 12049:12049 -p 12445:12445 -p 8080:8080 \
  -v /path/to/config.yaml:/config/config.yaml:ro \
  -v dittofs-data:/data \
  marmos91c/dittofs:latest
```

### Build from source

```bash
git clone https://github.com/marmos91/dittofs.git
cd dittofs
go build -o dfs cmd/dfs/main.go
./dfs init
./dfs start
```

## First run and the admin password

On first start, DittoFS creates an `admin` user. By default it prints a
generated password once:

```
*** IMPORTANT: Admin user created with password: aBcDeFgHiJkLmNoPqRsTuVwX ***
```

Save it. The account is created with `MustChangePassword`, so you set a new
password on first login. To choose the password up front (handy for Docker,
Kubernetes, and CI), set it before the first start:

```bash
DITTOFS_ADMIN_INITIAL_PASSWORD=my-secure-password ./dfs start
```

## Mount your first NFS share

```bash
# 1. Start the server
./dfs start

# 2. Log in and set your password
./dfsctl login --server http://localhost:8080 --username admin
./dfsctl user change-password

# 3. Create a user with your host UID (needed for NFS write access)
./dfsctl user create --username $(whoami) --host-uid

# 4. Create stores
./dfsctl store metadata add --name default --type badger
./dfsctl store block local add --name local-cache --type fs
./dfsctl store block remote add --name s3-remote --type s3

# 5. Create a share and grant access
./dfsctl share create --name /export --metadata default \
  --local local-cache --remote s3-remote
./dfsctl share permission grant /export --user $(whoami) --level read-write

# 6. Enable the NFS adapter
./dfsctl adapter enable nfs

# 7. Mount it (Linux)
sudo mkdir -p /mnt/nfs
sudo mount -t nfs -o tcp,port=12049,mountport=12049 localhost:/export /mnt/nfs
echo "Hello DittoFS!" > /mnt/nfs/hello.txt
```

On macOS, mount with `resvport` and `nolock`:

```bash
sudo mount -t nfs -o tcp,port=12049,mountport=12049,resvport,nolock localhost:/export /tmp/nfs
```

:::note
The default NFS port is `12049`, not the standard `2049`. For quick local
testing with no external dependencies, use `--type memory` for both the
metadata and block stores instead of BadgerDB, the filesystem, and S3.
:::

## Next steps

- [Configuration](/docs/operations/configuration/) — tune the server and
  manage stores.
- [SMB](/docs/protocols/smb/) — serve the same shares to Windows and macOS.
- [Snapshots](/docs/storage/snapshots/) — point-in-time protection for shares.
