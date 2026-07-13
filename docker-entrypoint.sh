#!/bin/sh
set -e

mkdir -p "$DATA_DIR/photos/overlays"
chown -R photoboth:photoboth "$DATA_DIR"

exec gosu photoboth "$@"
