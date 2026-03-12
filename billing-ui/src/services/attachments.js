// Payment attachment storage
// Stores file metadata + base64 content keyed by paymentId or transactionExternalKey
// TODO: Replace localStorage with a proper file server / S3 when deployed

const STORAGE_KEY = 'billing_attachments';

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Save attachment for a payment
// key: paymentId or transactionExternalKey
export function saveAttachment(key, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const all = getAll();
      if (!all[key]) all[key] = [];
      all[key].push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result, // base64 data URL
        uploadedAt: new Date().toISOString(),
      });
      saveAll(all);
      resolve(all[key]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Get attachments for a payment key
export function getAttachments(key) {
  if (!key) return [];
  const all = getAll();
  return all[key] || [];
}

// Delete a specific attachment
export function deleteAttachment(key, attachmentId) {
  const all = getAll();
  if (all[key]) {
    all[key] = all[key].filter(a => a.id !== attachmentId);
    if (all[key].length === 0) delete all[key];
    saveAll(all);
  }
}

// Get all attachment keys (for admin/listing)
export function getAllAttachmentKeys() {
  return Object.keys(getAll());
}
