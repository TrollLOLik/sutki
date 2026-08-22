import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const contracts = [
  {
    entry: 'src/features/chat/index.ts',
    required: [
      'CHAT_DATA_MODE',
      'chatRepository',
      'useChatSnapshot',
      'BookingStatusPayload',
      'ChatAttachment',
      'ChatMessage',
      'Conversation',
      'ConversationFilter',
      'ConversationSort',
    ],
  },
  {
    entry: 'src/features/requests/index.ts',
    required: [
      'REQUEST_DATA_MODE',
      'requestRepository',
      'filterAndSortRequests',
      'isCurrentRequest',
      'useRequestsSnapshot',
      'RequestCard',
      'RequestDetail',
      'RequestDialog',
      'RequestsEmpty',
      'RentalRequest',
      'RequestDirection',
      'RequestSort',
      'RequestDialogState',
      'RequestTab',
    ],
  },
];

function collectNamedExports(source) {
  const names = new Set();
  const exportBlocks = source.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"]/g);

  for (const match of exportBlocks) {
    for (const rawPart of match[1].split(',')) {
      const part = rawPart.trim();
      if (!part) continue;
      const aliasMatch = part.match(/^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (aliasMatch) names.add(aliasMatch[2] ?? aliasMatch[1]);
    }
  }

  return names;
}

const failures = [];

for (const contract of contracts) {
  const absolutePath = path.join(root, contract.entry);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const exports = collectNamedExports(source);
  const missing = contract.required.filter((name) => !exports.has(name));
  if (missing.length > 0) {
    failures.push(`${contract.entry}: missing ${missing.join(', ')}`);
  }
}

if (failures.length > 0) {
  console.error('Feature entrypoint contract failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Feature entrypoint contract passed.');
