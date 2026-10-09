#!/bin/sh
set -eu
upload_directory=${UPLOAD_DIR:-/app/uploads}
mkdir -p "$upload_directory"
chown blogs:blogs "$upload_directory"
exec su-exec blogs:blogs /app/server
