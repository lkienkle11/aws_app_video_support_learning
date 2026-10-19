#!/bin/sh
cd "$(dirname "$0")" || exit 1
export CLOUD_STUDY_FILES="$PWD/files"
exec "./dist/Cloud Study.app/Contents/MacOS/cloud-study"
