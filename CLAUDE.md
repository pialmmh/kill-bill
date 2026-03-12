# Telcobright Billing System

## Project Overview
A standalone billing and subscription management platform built on top of **Kill Bill** (Apache 2.0).
Telcobright owns and customizes this as a product — clients (BTCL, ISPs, etc.) don't deal with licensing.

### Purpose
- ISP monthly recurring subscriptions (internet packages)
- Telecom service billing (Hosted PBX, Voice Broadcast, Contact Center, Bulk SMS)
- Prepaid automatic charging with wallet/credits
- Postpaid invoicing with dues tracking
- Dunning/overdue management with automatic service blocking/unblocking
- Invoice generation, payment tracking, refunds
- Subscription pause, resume, cancel, delete
- Multi-tenant: single DB, row-level isolation via `tenant_record_id`

### Architecture
```
┌─────────────────────────────────────┐
│  Custom React UI (planned)          │  Port: 5180
│  (SOFTSWITCH_DASHBOARD styling)     │
└──────────────┬──────────────────────┘
               │ REST API
┌──────────────▼──────────────────────┐
│  Kill Bill Server (Java/Jetty)      │  Port: 18080
│  - Subscription engine              │
│  - Invoice engine                   │
│  - Payment engine                   │
│  - Overdue/dunning engine           │
│  - Event bus → webhooks/kafka       │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  MySQL (killbill database)          │  127.0.0.1:3306
│  Multi-tenant: row-level isolation  │
└─────────────────────────────────────┘
```

### Event-Driven Integration
Kill Bill emits events for all lifecycle changes. External consumers handle:
- Line activation/deactivation via API calls
- Email notifications (invoice, overdue, payment receipt)
- Portal sync (update partner status in BTCL portal)
- Analytics and audit logging

## Tech Stack
| Component | Technology |
|-----------|-----------|
| Billing Engine | Kill Bill 0.24.16 (Java, Apache 2.0) |
| Build | Maven 3.9+ |
| JDK | **17** (Kill Bill requires JDK 11-17, uses 17.0.16-librca via SDKMAN) |
| Database | MySQL 127.0.0.1:3306, database: `killbill`, user: root/123456 |
| Server | Embedded Jetty (via Maven plugin) |
| Custom UI | React + Vite (planned, port 5180) |
| Styling | From SOFTSWITCH_DASHBOARD (MUI + Bootstrap + SCSS) |

**IMPORTANT**: This project uses JDK 17, NOT JDK 21. Kill Bill does not officially support JDK 21.
Set JAVA_HOME to `/home/mustafa/.sdkman/candidates/java/17.0.16-librca` before building/running.

## Project Structure
```
killbill-billing/
├── killbill-server/          # Kill Bill source (cloned v0.24.16)
│   ├── profiles/killbill/    # Server profile with embedded Jetty
│   ├── account/              # Account module
│   ├── invoice/              # Invoice module
│   ├── payment/              # Payment module
│   ├── subscription/         # Subscription module
│   ├── overdue/              # Overdue/dunning module
│   ├── catalog/              # Catalog module
│   └── pom.xml               # Root Maven POM
├── catalogs/
│   ├── isp-catalog.xml       # Product catalog (ISP + telecom services)
│   └── overdue-config.xml    # Dunning rules (WARNING→SUSPENDED→DISCONNECTED)
├── killbill-server.properties  # Custom server config (port 18080)
├── ddl.sql                   # Database schema DDL
├── build.sh                  # Build Kill Bill (./build.sh or ./build.sh --quick)
├── start.sh                  # Start server on port 18080 (./start.sh or ./start.sh --debug)
├── reset-db.sh               # Drop and recreate database
├── setup-tenant.sh           # Create first tenant + upload catalog
├── test-api.sh               # Test subscription flow end-to-end
└── CLAUDE.md                 # This file
```

## Quick Start
```bash
# 1. Build (first time, takes ~5 min)
./build.sh

# 2. Start Kill Bill on port 18080
./start.sh

# 3. In another terminal, create tenant and upload catalog
./setup-tenant.sh

# 4. Test the API
./test-api.sh
```

## Quick Rebuild After Changes
```bash
# Quick rebuild (only changed modules)
./build.sh --quick

# Restart
./start.sh
```

## Key Ports
| Service | Port |
|---------|------|
| Kill Bill API | 18080 |
| Kill Bill Debug | 18000 (with --debug flag) |
| Custom React UI | 5180 (planned) |

## First Tenant: telcobright-isp
| Field | Value |
|-------|-------|
| API Key | `telcobright-isp` |
| API Secret | `telcobright-isp-secret` |
| Auth | `admin:password` (Kill Bill default) |

## Catalog: Products & Plans
| Product | Plan | Price (BDT/month) | Category |
|---------|------|--------------------|----------|
| Internet-100Mbps | internet-100mbps-prepaid-monthly | 1,200 | BASE |
| Internet-50Mbps | internet-50mbps-prepaid-monthly | 800 | BASE |
| Internet-200Mbps | internet-200mbps-prepaid-monthly | 1,800 | BASE |
| HostedPBX | hosted-pbx-monthly | 1,200 | BASE |
| VoiceBroadcast | voice-broadcast-monthly | 1,800 | BASE |
| ContactCenter | contact-center-monthly | 850 | BASE |
| BulkSMS | bulk-sms-monthly | 500 | BASE |
| StaticIP | static-ip-monthly | 300 | ADD_ON |

## Overdue/Dunning Policy
| Days Unpaid | State | Action |
|-------------|-------|--------|
| 7 | WARNING | Notification sent, service still active |
| 14 | SUSPENDED | Service blocked (entitlement disabled) |
| 30 | DISCONNECTED | Full disconnect, changes blocked |
| Payment received | CLEAR | Auto-restores to good standing |

## Kill Bill REST API Quick Reference
All requests need these headers:
```
-u admin:password
-H 'X-Killbill-ApiKey: telcobright-isp'
-H 'X-Killbill-ApiSecret: telcobright-isp-secret'
-H 'X-Killbill-CreatedBy: admin'
```

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create account | POST | `/1.0/kb/accounts` |
| Get account | GET | `/1.0/kb/accounts/{id}` |
| Create subscription | POST | `/1.0/kb/subscriptions` |
| Pause subscription | PUT | `/1.0/kb/subscriptions/{id}/pause` |
| Resume subscription | PUT | `/1.0/kb/subscriptions/{id}/resume` |
| Cancel subscription | DELETE | `/1.0/kb/subscriptions/{id}` |
| List invoices | GET | `/1.0/kb/accounts/{id}/invoices` |
| Get invoice details | GET | `/1.0/kb/invoices/{id}?withItems=true` |
| Pay invoice | POST | `/1.0/kb/invoices/{invoiceId}/payments` |
| Get invoice payments | GET | `/1.0/kb/invoices/{invoiceId}/payments` |
| Get account payments | GET | `/1.0/kb/accounts/{id}/payments` |
| Get payment detail | GET | `/1.0/kb/payments/{paymentId}?withAttempts=true` |
| Search payments | GET | `/1.0/kb/payments/search/{key}` |
| Get overdue state | GET | `/1.0/kb/accounts/{id}/overdue` |
| Upload catalog | POST | `/1.0/kb/catalog/xml` |
| Get catalog | GET | `/1.0/kb/catalog/simpleCatalog` |
| Register webhook | POST | `/1.0/kb/tenants/registerNotificationCallback` |
| Create tenant | POST | `/1.0/kb/tenants` |

Full API docs: https://apidocs.killbill.io

## Payment API Reference

### Pay an Invoice (Manual / External)
```bash
# Full or partial payment — same API for manual admin and gateway callback
curl -X POST "http://localhost:18080/1.0/kb/invoices/{invoiceId}/payments" \
  -u admin:password \
  -H 'X-Killbill-ApiKey: telcobright-isp' \
  -H 'X-Killbill-ApiSecret: telcobright-isp-secret' \
  -H 'X-Killbill-CreatedBy: admin' \
  -H 'Content-Type: application/json' \
  -d '{
    "accountId": "{accountId}",
    "purchasedAmount": 500,
    "currency": "BDT",
    "isExternal": true,
    "transactionExternalKey": "BKASH:TRX123456:Monthly payment"
  }'
# Returns: 201 Created, Location header contains payment ID
```

### Payment Fields
| Field | Required | Description |
|-------|----------|-------------|
| `accountId` | Yes | Kill Bill account UUID |
| `purchasedAmount` | Yes | Amount to pay (supports partial — pay less than invoice balance) |
| `currency` | Yes | `BDT`, `USD`, etc. |
| `isExternal` | For manual | Set `true` for manual/external payments (no gateway plugin) |
| `paymentMethodId` | For gateway | Kill Bill payment method UUID (from gateway plugin registration) |
| `transactionExternalKey` | No | External reference for tracking. Format: `METHOD:REFERENCE:NOTE` |

### transactionExternalKey Convention
We encode payment metadata in `transactionExternalKey` as colon-separated values:
```
{PAYMENT_METHOD}:{EXTERNAL_REFERENCE}:{NOTE}
```
Examples:
- `CASH` — cash payment, no reference
- `BANK_TRANSFER:REF20260313001:March payment` — bank transfer with reference
- `BKASH:TRX9A8B7C:` — bKash mobile payment with transaction ID
- `ONLINE:ORD-12345:SSLCommerz` — gateway payment with order ID

Payment methods: `CASH`, `BANK_TRANSFER`, `BKASH`, `NAGAD`, `ROCKET`, `CHEQUE`, `ONLINE`, `OTHER`

### Gateway Integration Pattern
For online payment gateway (e.g., SSLCommerz):
1. Frontend initiates payment → redirect to gateway
2. Gateway processes → sends callback to your backend
3. Backend callback handler calls `payInvoice()` with:
   - `isExternal: true` (or use a Kill Bill payment plugin)
   - `transactionExternalKey: "ONLINE:{gateway_order_id}:{gateway_name}"`
4. Kill Bill records payment → clears overdue if fully paid
5. UI shows receipt with gateway reference

### Payment Receipt Tracking
- Each payment gets a unique `paymentId` (UUID) from Kill Bill
- Each transaction within a payment gets a `transactionId` (UUID)
- `transactionExternalKey` stores the external reference (bank ref, gateway order ID, etc.)
- Receipt is viewable and printable from UI (Payments tab or Invoices page)
- `GET /payments/{paymentId}?withAttempts=true` returns full payment detail with all transaction attempts

## Integration with BTCL SMS Portal
The BTCL SMS Portal at `/home/mustafa/telcobright-projects/btcl-sms-portal` will push purchases to this billing system via:
1. REST API calls from portal backend to Kill Bill
2. Or Kafka topics (future)

Flow: Portal purchase → Kill Bill subscription → Invoice → Payment → Activation event → Portal callback

## UI Pages
| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Overview metrics |
| Customers | `/customers` | List, create, click to detail |
| Customer Detail | `/customers/:id` | Subscriptions, invoices, payments, AR summary, purchase, pay, receipt |
| Subscriptions | `/subscriptions` | All subscriptions across customers |
| Invoices | `/invoices` | All invoices with pay button, partial payment, receipt |
| Payments | `/payments` | All payments with method/reference, receipt view/print |
| Catalog | `/catalog` | Plans with features, category filter |
| AR Report | `/reports/ar` | Cross-customer accounts receivable summary |
| Tenants | `/tenants` | Super admin: create/manage tenants |

## Future Work
- [x] Custom React UI with MUI (port 5180)
- [x] Multi-tenant management with login/tenant selector
- [x] Subscription purchase from UI
- [x] Full/partial payment with method tracking and receipt
- [x] Accounts receivable report
- [ ] SSLCommerz payment gateway integration
- [ ] Kafka event bridge for external consumers
- [ ] Email notification consumer (invoice, payment receipt, overdue)
- [ ] Line activation/deactivation plugin
- [ ] Per-tenant invoice templates
- [ ] Usage-based billing for SMS/voice
- [ ] ERPNext accounting integration (Phase 2)
