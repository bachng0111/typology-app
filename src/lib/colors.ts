export interface BucketColor {
  name: string;
  /** Strong accent: header, outlines, chip border. */
  accent: string;
  /** Light panel tint. */
  tint: string;
  /** Chip background inside the bucket. */
  chip: string;
}

// Hues chosen to stay distinguishable from each other and from the neutral ungrouped cards.
export const BUCKET_COLORS: BucketColor[] = [
  { name: 'indigo', accent: '#4f46e5', tint: '#eef2ff', chip: '#e0e7ff' },
  { name: 'amber', accent: '#d97706', tint: '#fffbeb', chip: '#fef3c7' },
  { name: 'emerald', accent: '#059669', tint: '#ecfdf5', chip: '#d1fae5' },
  { name: 'pink', accent: '#db2777', tint: '#fdf2f8', chip: '#fce7f3' },
  { name: 'sky', accent: '#0284c7', tint: '#f0f9ff', chip: '#e0f2fe' },
  { name: 'red', accent: '#dc2626', tint: '#fef2f2', chip: '#fee2e2' },
  { name: 'violet', accent: '#7c3aed', tint: '#f5f3ff', chip: '#ede9fe' },
  { name: 'lime', accent: '#65a30d', tint: '#f7fee7', chip: '#ecfccb' },
  { name: 'teal', accent: '#0d9488', tint: '#f0fdfa', chip: '#ccfbf1' },
  { name: 'orange', accent: '#ea580c', tint: '#fff7ed', chip: '#ffedd5' },
];

export function bucketColor(index: number): BucketColor {
  const n = BUCKET_COLORS.length;
  return BUCKET_COLORS[((index % n) + n) % n];
}
