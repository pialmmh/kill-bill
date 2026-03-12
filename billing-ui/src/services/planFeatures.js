// Plan features configuration
// Maps Kill Bill plan names to their service attributes/features
// Not all plans have all attributes — only relevant ones are listed

const planFeatures = {
  'internet-50mbps-monthly': {
    displayName: 'Internet 50 Mbps',
    category: 'Internet',
    price: 800,
    features: {
      bandwidth: '50 Mbps',
      transferLimit: '500 GB',
      ipType: 'Dynamic',
      uptime: '99.5%',
    },
  },
  'internet-100mbps-monthly': {
    displayName: 'Internet 100 Mbps',
    category: 'Internet',
    price: 1200,
    features: {
      bandwidth: '100 Mbps',
      transferLimit: '1 TB',
      ipType: 'Dynamic',
      uptime: '99.5%',
    },
  },
  'internet-200mbps-monthly': {
    displayName: 'Internet 200 Mbps',
    category: 'Internet',
    price: 1800,
    features: {
      bandwidth: '200 Mbps',
      transferLimit: '2 TB',
      ipType: 'Dynamic',
      uptime: '99.9%',
    },
  },
  'hosted-pbx-monthly': {
    displayName: 'Hosted PBX',
    category: 'Telecom',
    price: 1200,
    features: {
      sipChannels: '30',
      extensions: '50',
      fixedLineRent: 'Included',
      recording: 'Yes',
      ivr: 'Yes',
    },
  },
  'voice-broadcast-monthly': {
    displayName: 'Voice Broadcast',
    category: 'Telecom',
    price: 1800,
    features: {
      concurrentCalls: '20',
      monthlyMinutes: '10,000',
      ttsSupport: 'Yes',
      scheduling: 'Yes',
    },
  },
  'contact-center-monthly': {
    displayName: 'Contact Center',
    category: 'Telecom',
    price: 850,
    features: {
      agentSeats: '10',
      sipChannels: '15',
      omnichannel: 'Voice + Chat',
      queueManagement: 'Yes',
      reporting: 'Yes',
    },
  },
  'bulk-sms-monthly': {
    displayName: 'Bulk SMS',
    category: 'Messaging',
    price: 500,
    features: {
      monthlySMS: '5,000',
      senderIds: '3',
      unicodeSupport: 'Yes',
      apiAccess: 'Yes',
    },
  },
  'static-ip-monthly': {
    displayName: 'Static IP',
    category: 'Add-on',
    price: 300,
    features: {
      ipCount: '1',
      ipType: 'IPv4 Static',
    },
  },
};

// Feature labels for display
const featureLabels = {
  bandwidth: 'Bandwidth',
  transferLimit: 'Transfer Limit',
  ipType: 'IP Type',
  ipCount: 'IP Addresses',
  uptime: 'SLA Uptime',
  sipChannels: 'SIP Channels',
  extensions: 'Extensions',
  fixedLineRent: 'Fixed Line Rent',
  recording: 'Call Recording',
  ivr: 'IVR',
  concurrentCalls: 'Concurrent Calls',
  monthlyMinutes: 'Monthly Minutes',
  ttsSupport: 'Text-to-Speech',
  scheduling: 'Scheduling',
  agentSeats: 'Agent Seats',
  omnichannel: 'Channels',
  queueManagement: 'Queue Management',
  reporting: 'Reporting',
  monthlySMS: 'Monthly SMS',
  senderIds: 'Sender IDs',
  unicodeSupport: 'Unicode/Bangla',
  apiAccess: 'API Access',
};

// Map plan names to Kill Bill product names
const planToProduct = {
  'internet-50mbps-monthly': 'Internet-50Mbps',
  'internet-100mbps-monthly': 'Internet-100Mbps',
  'internet-200mbps-monthly': 'Internet-200Mbps',
  'hosted-pbx-monthly': 'HostedPBX',
  'voice-broadcast-monthly': 'VoiceBroadcast',
  'contact-center-monthly': 'ContactCenter',
  'bulk-sms-monthly': 'BulkSMS',
  'static-ip-monthly': 'StaticIP',
};

export const getPlanFeatures = (planName) => planFeatures[planName] || null;
export const getFeatureLabel = (key) => featureLabels[key] || key;
export const getAllPlans = () => planFeatures;
export const getProductName = (planName) => planToProduct[planName] || planName;
export default planFeatures;
