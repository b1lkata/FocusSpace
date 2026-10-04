import { createPreviewBridge } from './bridge';

function pickImport(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
    const finish = () => input.remove();
    input.addEventListener('cancel', () => { finish(); resolve(null); }, { once: true });
    input.addEventListener('change', () => {
      const file = input.files?.[0]; finish();
      if (!file) { resolve(null); return; }
      if (file.size > 5_000_000) { reject(new Error('Import file is too large (maximum 5 MB).')); return; }
      void file.text().then(resolve, reject);
    }, { once: true });
    document.body.append(input); input.click();
  });
}

export function browserPreviewBridge() {
  return createPreviewBridge({
    storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
    pickImport,
    downloadExport(content) {
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'focusspace-preview-export.json';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
}
