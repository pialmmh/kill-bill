// Bootstrap: ensure the initial tenant is registered in local storage
import { getTenants, addTenant } from './auth';

export function bootstrapTenants() {
  const tenants = getTenants();

  // Register the initial telcobright-isp tenant if not present
  if (!tenants.find(t => t.apiKey === 'telcobright-isp')) {
    addTenant({
      name: 'Telcobright ISP',
      apiKey: 'telcobright-isp',
      apiSecret: 'telcobright-isp-secret',
      externalKey: 'telcobright-isp',
      adminUsername: 'isp-admin',
      adminPassword: 'isp123',
      createdAt: '2026-03-13T00:00:00Z',
      kbRegistered: true,
    });
  }
}
