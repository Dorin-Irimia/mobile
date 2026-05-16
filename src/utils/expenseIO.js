import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const CSV_COLUMNS = [
  'householdId', 'title', 'amount', 'currency', 'category',
  'date', 'time', 'merchant', 'location', 'notes', 'splitMode',
];

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function expensesToCsv(items) {
  const header = CSV_COLUMNS.join(',');
  const rows = items.map(it =>
    CSV_COLUMNS.map(c => csvEscape(it[c])).join(','),
  );
  return [header, ...rows].join('\n');
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function csvToExpenses(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    const obj = {};
    header.forEach((col, i) => {
      const value = cells[i];
      if (value === undefined || value === '') return;
      obj[col] = col === 'amount' ? Number(value) : value;
    });
    return obj;
  });
}

export async function exportExpenses(items, { format = 'json', householdName = '' } = {}) {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = householdName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'cheltuieli';
  const filename = `${slug}-${stamp}.${format === 'csv' ? 'csv' : 'json'}`;
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;

  const body = format === 'csv'
    ? expensesToCsv(items)
    : JSON.stringify({ exportedAt: new Date().toISOString(), count: items.length, items }, null, 2);

  await FileSystem.writeAsStringAsync(fileUri, body, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: format === 'csv' ? 'text/csv' : 'application/json',
      dialogTitle: `Exportă cheltuieli (${format.toUpperCase()})`,
    });
  }
  return fileUri;
}

export async function pickExpensesFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/csv', 'text/comma-separated-values', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  const name = (asset.name || '').toLowerCase();
  let items;
  if (name.endsWith('.csv') || /^\s*\w[\w\s]*,/.test(content)) {
    items = csvToExpenses(content);
  } else {
    const parsed = JSON.parse(content);
    items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.expenses || []);
  }
  return { items, fileName: asset.name };
}
