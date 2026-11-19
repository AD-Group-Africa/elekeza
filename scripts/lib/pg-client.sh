#!/usr/bin/env bash
# Elekeza — PostgreSQL client discovery shared by the backup/restore tooling.
#
# The problem this solves: PostgreSQL's pg_dump/pg_restore refuse to talk to a
# server with a newer major version ("aborting because of server version
# mismatch"). The deployment target is PostgreSQL 16 (docker-compose.yml pins
# postgres:16-alpine) while local development runs 15, so a hard-coded client
# directory is wrong on at least one of them.
#
# Discovery order:
#   1. An explicitly requested directory (--pg-bin flag on the caller, then
#      $ELEKEZA_PG_BIN) — honoured first, but still version-checked.
#   2. Every PostgreSQL installation on the machine, newest-sufficient first.
#   3. Whatever is on PATH.
#
# A client whose major version is below the server's major version is never
# selected. If nothing suitable exists, the caller fails with exit code 3
# instead of dumping with an incompatible binary.
#
# No function here prints or returns a password.

pgc_tool_path() { # pgc_tool_path <dir> <tool> -> path or empty
  local d="$1" t="$2"
  if [ -n "$d" ] && [ -x "$d/$t.exe" ]; then printf '%s' "$d/$t.exe"; return 0; fi
  if [ -n "$d" ] && [ -x "$d/$t" ]; then printf '%s' "$d/$t"; return 0; fi
  printf ''
}

pgc_tool_major() { # pgc_tool_major <path> -> major version or empty
  local p="$1" out
  [ -n "$p" ] && [ -x "$p" ] || { printf ''; return 0; }
  out="$("$p" --version 2>/dev/null || true)"
  printf '%s' "$(printf '%s' "$out" | sed -n 's/.*PostgreSQL) \([0-9][0-9]*\).*/\1/p')"
}

# Prints candidate bin directories, explicit override first, then every
# installation found on the machine (Windows Git Bash, Debian/Ubuntu, RHEL,
# Postgres.app), and finally the empty marker meaning "PATH".
pgc_candidate_dirs() {
  local d
  {
    [ -n "${PGC_EXPLICIT_DIR:-}" ] && printf '%s\n' "$PGC_EXPLICIT_DIR"
    [ -n "${ELEKEZA_PG_BIN:-}" ] && printf '%s\n' "$ELEKEZA_PG_BIN"
    for d in "/c/Program Files/PostgreSQL"/*/bin; do
      [ -d "$d" ] && printf '%s\n' "$d"
    done
    for d in /usr/lib/postgresql/*/bin /usr/pgsql-*/bin \
             /Applications/Postgres.app/Contents/Versions/*/bin; do
      [ -d "$d" ] && printf '%s\n' "$d"
    done
    printf '\n'
  } | awk 'NF || $0 == "" { if (!seen[$0]++) print }'
}

# pgc_find_psql — any runnable psql (a lower-major psql can still query a newer
# server, which is all we need to learn the server version). Empty on failure.
pgc_find_psql() {
  local d p
  while IFS= read -r d; do
    p="$(pgc_tool_path "$d" psql)"
    if [ -n "$p" ]; then printf '%s' "$p"; return 0; fi
    if [ -z "$d" ]; then
      p="$(command -v psql 2>/dev/null || true)"
      if [ -n "$p" ]; then printf '%s' "$p"; return 0; fi
    fi
  done < <(pgc_candidate_dirs)
  printf ''
}

# pgc_server_version_num <host> <port> <user> <db> -> e.g. 160016, empty on failure
pgc_server_version_num() {
  local host="$1" port="$2" user="$3" db="$4" psql_bin num
  psql_bin="$(pgc_find_psql)"
  [ -n "$psql_bin" ] || { printf ''; return 0; }
  num="$(PGPASSWORD="${PGPASSWORD:-}" "$psql_bin" \
    -h "$host" -p "$port" -U "$user" -d "$db" -tAc \
    "select current_setting('server_version_num')" 2>/dev/null | tr -d ' \r\n' || true)"
  case "$num" in
    ''|*[!0-9]*) printf ''; return 0;;
  esac
  printf '%s' "$num"
}

# pgc_pick_tool <tool> <min_major> [prefer_dir]
# Prefers an exact major match, otherwise the lowest sufficient major, so a
# PostgreSQL 16 server never receives a dump from a 15 client and is never
# accidentally downgraded in behaviour by picking the newest available major.
pgc_pick_tool() {
  local tool="$1" min="$2" prefer="${3:-}"
  local d p m best="" best_major="" exact=""

  if [ -n "$prefer" ]; then
    p="$(pgc_tool_path "$prefer" "$tool")"
    m="$(pgc_tool_major "$p")"
    if [ -n "$m" ] && [ "$m" -ge "$min" ]; then
      printf '%s' "$p"; return 0
    fi
  fi

  while IFS= read -r d; do
    if [ -z "$d" ]; then
      p="$(command -v "$tool" 2>/dev/null || true)"
    else
      p="$(pgc_tool_path "$d" "$tool")"
    fi
    [ -n "$p" ] || continue
    m="$(pgc_tool_major "$p")"
    [ -n "$m" ] || continue
    [ "$m" -ge "$min" ] || continue
    if [ "$m" -eq "$min" ]; then printf '%s' "$p"; return 0; fi
    if [ -z "$best_major" ] || [ "$m" -lt "$best_major" ]; then
      best="$p"; best_major="$m"
    fi
  done < <(pgc_candidate_dirs)

  printf '%s' "$best"
}

# pgc_require_client <tool> <min_major> [prefer_dir]
# Like pgc_pick_tool but reports the failure the way an operator needs it.
pgc_require_client() {
  local tool="$1" min="$2" prefer="${3:-}" found
  found="$(pgc_pick_tool "$tool" "$min" "$prefer")"
  if [ -z "$found" ]; then
    echo "FATAL: no compatible $tool for a PostgreSQL $min server." >&2
    echo "       Install PostgreSQL $min client tools, or set ELEKEZA_PG_BIN" >&2
    echo "       (or pass --pg-bin) to the matching bin directory." >&2
    echo "       Run 'docker exec <db-container> $tool --version' where the database" >&2
    echo "       runs in a container — the container's own client always matches." >&2
    return 3
  fi
  printf '%s' "$found"
}
