#!/bin/bash
#
# Reset Kill Bill database (DROP and recreate)
# Usage: ./reset-db.sh
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DDL_FILE="$SCRIPT_DIR/ddl.sql"

echo "WARNING: This will DROP and recreate the killbill database!"
read -p "Are you sure? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Aborted."
    exit 0
fi

echo "Dropping and recreating killbill database..."
mysql -h 127.0.0.1 -P 3306 -u root -p123456 -e "DROP DATABASE IF EXISTS killbill; CREATE DATABASE killbill;" 2>&1

echo "Loading DDL schema..."
mysql -h 127.0.0.1 -P 3306 -u root -p123456 killbill < "$DDL_FILE" 2>&1

echo "Done. Tables created:"
mysql -h 127.0.0.1 -P 3306 -u root -p123456 killbill -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='killbill';" 2>&1
