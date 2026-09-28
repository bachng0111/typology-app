export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type = 'text/plain') {
  // BOM so Excel and friends detect UTF-8.
  downloadBlob(new Blob(['\uFEFF', text], { type: `${type};charset=utf-8` }), filename);
}
