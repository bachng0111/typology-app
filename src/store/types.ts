export interface Item {
  id: string;
  text: string;
  /** Board coordinates of the card's top-left corner. Only meaningful while ungrouped. */
  x: number;
  y: number;
}

export interface Bucket {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  colorIndex: number;
  /** Ordered membership. This is the single source of truth for grouping. */
  itemIds: string[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** The part of a board that is tracked by undo/redo. */
export interface BoardContent {
  items: Record<string, Item>;
  buckets: Record<string, Bucket>;
  bucketOrder: string[];
}

export interface Board extends BoardContent {
  version: number;
  id: string;
  name: string;
  delimiter: string;
  createdAt: number;
  updatedAt: number;
  viewport: Viewport;
}

export interface BoardSummary {
  id: string;
  name: string;
  itemCount: number;
  bucketCount: number;
  groupedCount: number;
  updatedAt: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
