# Docker profile for Codex

`seccomp-codex.json` derives from the Moby default profile at revision `4b8214fc4971e06172938a1f1554ccff6647ee80`. The last rule allows `clone`, `unshare`, `mount`, `umount2` and `pivot_root` so Codex can create its own bubblewrap sandbox. The Compose override uses this profile for VibeIDE without granting extra Linux capabilities.

Use `docker compose -f compose.yaml -f compose.codex.yaml up -d --build` when Codex runs inside the container.

[Moby default profile](https://github.com/moby/profiles/blob/4b8214fc4971e06172938a1f1554ccff6647ee80/seccomp/default.json)
