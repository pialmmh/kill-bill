#!/bin/bash
#
# Test Kill Bill API with sample ISP subscription flow
# Run AFTER setup-tenant.sh
#

KB_URL="http://127.0.0.1:18080"
API_KEY="telcobright-isp"
API_SECRET="telcobright-isp-secret"

COMMON_HEADERS="-H 'X-Killbill-ApiKey: $API_KEY' -H 'X-Killbill-ApiSecret: $API_SECRET' -H 'X-Killbill-CreatedBy: admin' -u admin:password"

echo "=== 1. Check catalog ==="
eval curl -s "$KB_URL/1.0/kb/catalog/simpleCatalog" $COMMON_HEADERS | python3 -m json.tool 2>/dev/null | head -30

echo ""
echo "=== 2. Create a customer account ==="
ACCOUNT_RESPONSE=$(eval curl -s -w "\n%{http_code}" -X POST "$KB_URL/1.0/kb/accounts" \
    $COMMON_HEADERS \
    -H "'Content-Type: application/json'" \
    -d "'{
        \"name\": \"Test ISP Customer\",
        \"email\": \"customer@example.com\",
        \"currency\": \"BDT\",
        \"externalKey\": \"ISP-CUST-001\",
        \"phone\": \"+8801700000001\",
        \"company\": \"Test Company Ltd\",
        \"address1\": \"123 Dhaka Road\",
        \"city\": \"Dhaka\",
        \"country\": \"BD\",
        \"locale\": \"en_BD\",
        \"timeZone\": \"Asia/Dhaka\"
    }'")

HTTP_CODE=$(echo "$ACCOUNT_RESPONSE" | tail -1)
echo "HTTP $HTTP_CODE"

# Get account ID
ACCOUNT_ID=$(eval curl -s "$KB_URL/1.0/kb/accounts?externalKey=ISP-CUST-001" $COMMON_HEADERS | python3 -c "import sys,json; print(json.load(sys.stdin)['accountId'])" 2>/dev/null)
echo "Account ID: $ACCOUNT_ID"

if [ -z "$ACCOUNT_ID" ] || [ "$ACCOUNT_ID" = "" ]; then
    echo "Failed to get account ID. Is Kill Bill running?"
    exit 1
fi

echo ""
echo "=== 3. Subscribe to Internet 100 Mbps Prepaid Monthly ==="
eval curl -s -X POST "$KB_URL/1.0/kb/subscriptions" \
    $COMMON_HEADERS \
    -H "'Content-Type: application/json'" \
    -d "'{
        \"accountId\": \"$ACCOUNT_ID\",
        \"externalKey\": \"ISP-SUB-001\",
        \"productName\": \"Internet-100Mbps\",
        \"productCategory\": \"BASE\",
        \"billingPeriod\": \"MONTHLY\",
        \"priceList\": \"DEFAULT\"
    }'" | python3 -m json.tool 2>/dev/null

echo ""
echo "=== 4. Check invoices ==="
sleep 2
eval curl -s "$KB_URL/1.0/kb/accounts/$ACCOUNT_ID/invoices?withItems=true" $COMMON_HEADERS | python3 -m json.tool 2>/dev/null

echo ""
echo "=== 5. Check subscription status ==="
eval curl -s "$KB_URL/1.0/kb/accounts/$ACCOUNT_ID/bundles" $COMMON_HEADERS | python3 -m json.tool 2>/dev/null | head -40

echo ""
echo "=== Done ==="
echo "Account ID: $ACCOUNT_ID"
echo ""
echo "More commands to try:"
echo "  # Pause subscription:"
echo "  curl -X PUT '$KB_URL/1.0/kb/subscriptions/SUBSCRIPTION_ID/pause' -u admin:password -H 'X-Killbill-ApiKey: $API_KEY' -H 'X-Killbill-ApiSecret: $API_SECRET' -H 'X-Killbill-CreatedBy: admin'"
echo ""
echo "  # Cancel subscription:"
echo "  curl -X DELETE '$KB_URL/1.0/kb/subscriptions/SUBSCRIPTION_ID' -u admin:password -H 'X-Killbill-ApiKey: $API_KEY' -H 'X-Killbill-ApiSecret: $API_SECRET' -H 'X-Killbill-CreatedBy: admin'"
