#!/bin/bash
#
# Create the first tenant and upload catalog
# Run this AFTER Kill Bill is started
#

KB_URL="http://127.0.0.1:18080"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Waiting for Kill Bill to be ready..."
for i in $(seq 1 30); do
    if curl -s "$KB_URL/1.0/healthcheck" | grep -q "healthy"; then
        echo "Kill Bill is ready!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

# Create tenant: telcobright-isp
echo ""
echo "=== Creating tenant: telcobright-isp ==="
curl -s -X POST "$KB_URL/1.0/kb/tenants" \
    -H "Content-Type: application/json" \
    -H "X-Killbill-CreatedBy: admin" \
    -u admin:password \
    -d '{
        "apiKey": "telcobright-isp",
        "apiSecret": "telcobright-isp-secret",
        "externalKey": "telcobright-isp"
    }' | python3 -m json.tool 2>/dev/null || echo "(created)"

echo ""
echo "=== Uploading ISP catalog ==="
curl -s -X POST "$KB_URL/1.0/kb/catalog/xml" \
    -H "Content-Type: text/xml" \
    -H "X-Killbill-ApiKey: telcobright-isp" \
    -H "X-Killbill-ApiSecret: telcobright-isp-secret" \
    -H "X-Killbill-CreatedBy: admin" \
    -u admin:password \
    -d @"$SCRIPT_DIR/catalogs/isp-catalog.xml"

echo ""
echo "=== Uploading overdue config ==="
curl -s -X POST "$KB_URL/1.0/kb/overdue/xml" \
    -H "Content-Type: text/xml" \
    -H "X-Killbill-ApiKey: telcobright-isp" \
    -H "X-Killbill-ApiSecret: telcobright-isp-secret" \
    -H "X-Killbill-CreatedBy: admin" \
    -u admin:password \
    -d @"$SCRIPT_DIR/catalogs/overdue-config.xml"

echo ""
echo "=== Tenant setup complete ==="
echo ""
echo "Tenant API Key:    telcobright-isp"
echo "Tenant API Secret: telcobright-isp-secret"
echo "Kill Bill API:     $KB_URL"
echo ""
echo "Test with:"
echo "  curl -u admin:password -H 'X-Killbill-ApiKey: telcobright-isp' -H 'X-Killbill-ApiSecret: telcobright-isp-secret' $KB_URL/1.0/kb/catalog/simpleCatalog"
