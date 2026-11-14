#!/bin/bash
set -euo pipefail
umask 077

project="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
tool_root="$(cd -- "${BB_TOOLCHAIN_ROOT:-$project}" && pwd -P)"
tools="$tool_root/.local"
cache="$tool_root/.cache"
node_version=24.14.0
rustup_version=1.29.3
rust_version=1.95.0
sandbox_version=2.14.0
node_sha=a1a54f46a750d2523d628d924aab61758a51c9dad3e0238beb14141be9615dd3
rustup_sha=63752a1919a3a4793173ec70f8f212621a7ce38ba6a246095984482f4de20f9f
sandbox_archive_sha=ea53448ef97540c012e5c3d967c74d78292b0465a98cf7027811a936718fe232
sandbox_binary_sha=8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a

fail() { printf '%s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'EOF'
Usage: ./scripts/mac.sh bootstrap
       ./scripts/mac.sh sdk-sandbox [--offline]
       ./scripts/mac.sh wasm [--offline]
       ./scripts/mac.sh web [--offline]
       ./scripts/mac.sh unit [--offline]
       ./scripts/mac.sh env <command> [args...]
Run from any directory on a native Apple Silicon Mac. See scripts/README.md.
EOF
}

[[ $# -gt 0 ]] || { usage; exit 2; }
[[ "$1" != '--help' ]] || { usage; exit 0; }
[[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 ]] || fail 'Use a native Apple Silicon Mac (Darwin arm64).'

export CARGO_HOME="$tools/cargo"
export RUSTUP_HOME="$tools/rustup"
export RUSTUP_DIST_SERVER=https://static.rust-lang.org
export CARGO_BUILD_JOBS=2
export CARGO_TARGET_DIR="$project/contracts/target"
export NEAR_SANDBOX_BIN_PATH="$tools/sandbox/$sandbox_version/near-sandbox"
export TMPDIR=/private/tmp
export PATH="$tools/node/$node_version/bin:$CARGO_HOME/bin:$PATH"
export npm_config_cache="$cache/npm"
export npm_config_registry=https://registry.npmjs.org
export npm_config_userconfig="$tools/npm-user.config"
export npm_config_globalconfig="$tools/npm-global.config"
export npm_config_update_notifier=false
unset RUSTUP_TOOLCHAIN RUSTFLAGS CARGO_ENCODED_RUSTFLAGS CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS

checksum() {
  local found
  found="$(shasum -a 256 < "$2")"
  [[ "${found%% *}" == "$1" ]] || fail "SHA-256 mismatch: $2"
}

download() {
  local url="$1" destination="$2" expected="$3" staging
  if [[ -f "$destination" ]]; then checksum "$expected" "$destination"; return; fi
  staging="$(mktemp "$cache/toolchain/download.XXXXXXXX")"
  if ! curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --connect-timeout 15 --max-time 180 --output "$staging" "$url"; then
    rm -f -- "$staging"
    fail "Could not download $url"
  fi
  checksum "$expected" "$staging"
  mv -- "$staging" "$destination"
}

runtime_ready() {
  [[ -x "$tools/node/$node_version/bin/node" && -x "$CARGO_HOME/bin/cargo" \
    && -x "$NEAR_SANDBOX_BIN_PATH" ]] || fail 'Run ./scripts/mac.sh bootstrap first.'
  [[ "$(node --version)" == "v$node_version" ]] || fail 'Unexpected project-local Node.js version.'
  [[ "$(npm --version)" == '11.9.0' ]] || fail 'Unexpected project-local npm version.'
  checksum "$sandbox_binary_sha" "$NEAR_SANDBOX_BIN_PATH"
}

bootstrap() {
  xcrun --find clang >/dev/null 2>&1 || fail 'Install Apple Command Line Tools, then rerun bootstrap: xcode-select --install'
  mkdir -p -- "$tools/node" "$tools/sandbox/$sandbox_version" "$cache/toolchain" "$cache/npm"
  local node_name="node-v$node_version-darwin-arm64" staging rustup_init sandbox_archive
  if [[ ! -x "$tools/node/$node_version/bin/node" ]]; then
    download "https://nodejs.org/dist/v$node_version/$node_name.tar.gz" "$cache/toolchain/$node_name.tar.gz" "$node_sha"
    staging="$(mktemp -d "$tools/node/install.XXXXXXXX")"
    tar -xzf "$cache/toolchain/$node_name.tar.gz" -C "$staging"
    mv -- "$staging/$node_name" "$tools/node/$node_version"
    rmdir -- "$staging"
  fi
  if [[ ! -x "$CARGO_HOME/bin/rustup" ]]; then
    rustup_init="$cache/toolchain/rustup-init-$rustup_version"
    download "https://static.rust-lang.org/rustup/archive/$rustup_version/aarch64-apple-darwin/rustup-init" \
      "$rustup_init" "$rustup_sha"
    chmod 700 "$rustup_init"
    RUSTUP_INIT_SKIP_PATH_CHECK=yes "$rustup_init" --no-modify-path --profile minimal \
      --default-host aarch64-apple-darwin --default-toolchain "$rust_version" --target wasm32-unknown-unknown -y
  fi
  if ! rustup target list --installed --toolchain "$rust_version" 2>/dev/null | grep -Fxq wasm32-unknown-unknown; then
    rustup toolchain install "$rust_version" --profile minimal --target wasm32-unknown-unknown --no-self-update
  fi
  if [[ ! -x "$NEAR_SANDBOX_BIN_PATH" ]]; then
    sandbox_archive="$cache/toolchain/near-sandbox-$sandbox_version-Darwin-arm64.tar.gz"
    download "https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/Darwin-arm64/$sandbox_version/near-sandbox.tar.gz" \
      "$sandbox_archive" "$sandbox_archive_sha"
    staging="$(mktemp -d "$tools/sandbox/install.XXXXXXXX")"
    tar -xzf "$sandbox_archive" -C "$staging" Darwin-arm64/near-sandbox
    checksum "$sandbox_binary_sha" "$staging/Darwin-arm64/near-sandbox"
    chmod 700 "$staging/Darwin-arm64/near-sandbox"
    mv -- "$staging/Darwin-arm64/near-sandbox" "$NEAR_SANDBOX_BIN_PATH"
    rmdir -- "$staging/Darwin-arm64" "$staging"
  fi
  runtime_ready
  printf 'Project-local tools in %s\n' "$tools"
  printf 'Node.js %s / npm %s\n' "$(node --version)" "$(npm --version)"
  (cd -- "$project/contracts" && rustc --version && cargo --version)
  "$NEAR_SANDBOX_BIN_PATH" --version
}

offline=()
npm_offline=()
set_mode() {
  if [[ $# -eq 1 && "$1" == '--offline' ]]; then offline=(--offline); npm_offline=(--offline)
  elif [[ $# -ne 0 ]]; then usage; exit 2
  fi
}

npm_install() {
  npm --prefix "$project/$1" ci ${npm_offline[@]+"${npm_offline[@]}"} --ignore-scripts --no-audit --no-fund >&2
}

build_wasm() {
  # Cargo appends these flags to the target's checked-in --cfg near. JSON quoting
  # preserves spaces, quotes and backslashes in the two absolute paths.
  local target_flags
  target_flags="$(node -p 'JSON.stringify(process.argv.slice(1))' -- \
    "--remap-path-prefix=$CARGO_HOME=/budgetbranch/cargo" \
    "--remap-path-prefix=$project/contracts=/budgetbranch/contracts")"
  (cd -- "$project/contracts" && cargo --config "target.wasm32-unknown-unknown.rustflags=$target_flags" \
    build ${offline[@]+"${offline[@]}"} --locked --release --target wasm32-unknown-unknown -p budgetbranch -p demo-receiver)
}

build_fixture() {
  build_wasm
  npm_install sdk
  npm --prefix "$project/sdk" run build >&2
  npm_install agents
  npm --prefix "$project/agents" run build >&2
}

case "$1" in
  bootstrap) [[ $# -eq 1 ]] || fail 'bootstrap takes no arguments'; bootstrap ;;
  wasm) shift; set_mode "$@"; runtime_ready; build_wasm ;;
  sdk-sandbox)
    shift; set_mode "$@"; runtime_ready
    build_fixture
    exec node "$project/tests/run-sandbox.mjs"
    ;;
  web)
    shift; set_mode "$@"; runtime_ready
    build_fixture
    npm_install web
    exec node "$project/scripts/sandbox-web.mjs"
    ;;
  unit)
    shift; set_mode "$@"; runtime_ready
    printf 'UNIT: Rust mocked execution contexts\n'
    (cd -- "$project/contracts" && cargo test ${offline[@]+"${offline[@]}"} --locked -p budgetbranch --lib)
    printf 'UNIT/MOCK: SDK and agents\n'
    npm_install sdk
    npm --prefix "$project/sdk" test
    npm_install agents
    npm --prefix "$project/agents" test
    ;;
  env) shift; [[ $# -gt 0 ]] || fail 'env requires a command'; runtime_ready; exec "$@" ;;
  *) usage; exit 2 ;;
esac
