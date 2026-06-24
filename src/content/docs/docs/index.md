---
title: Introduction
description: What DittoFS is, how it is structured, and where to go next.
sidebar:
  order: 0
---

DittoFS is a modular virtual filesystem written entirely in Go. It decouples
file access protocols from storage backends, so you can serve the same files
over NFSv3, NFSv4, NFSv4.1, and SMB2/3 from pluggable metadata and block
stores. It runs entirely in userspace, with no FUSE and no kernel modules, and
ships as a single binary.

:::caution[Experimental]
DittoFS is experimental and not production ready. Interfaces and on-disk
formats may change.
:::

## Key concepts

- **Protocol adapters** — NFS and SMB can run at the same time on one server.
- **Control plane** — central management of users, groups, shares, and
  configuration through a REST API.
- **Shares** — the export points clients mount, each referencing specific
  stores.
- **Named store registry** — reusable store instances shared across exports.
- **Pluggable storage** — mix metadata stores (memory, BadgerDB, PostgreSQL)
  and block stores (filesystem, S3) per share.

## Where to go next

- [Getting started](/docs/getting-started/getting-started/) — install the
  server and mount your first share.
- [Configuration](/docs/getting-started/configuration/) — server config and
  store management.
- [CLI reference](/docs/getting-started/cli/) — every `dfs` and `dfsctl`
  command.
- [NFS](/docs/connect/nfs/) and [SMB](/docs/connect/smb/) — protocol details
  and client usage.
- [Architecture](/docs/contributing/architecture/) — how the pieces fit
  together (for contributors).
