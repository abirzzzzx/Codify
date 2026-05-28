#!/data/data/com.termux/files/usr/bin/bash
# Redirect to the main setup.sh one level up
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$SCRIPT_DIR/../setup.sh" "$@"
