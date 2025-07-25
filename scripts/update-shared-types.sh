#!/bin/bash
# Update the shared-types submodule to the latest commit from the remote repository

# Change to the project root (the parent directory of this script)
cd "$(dirname "$0")/.."

git submodule update --remote src/shared-types

echo "shared-types submodule updated to latest remote commit." 