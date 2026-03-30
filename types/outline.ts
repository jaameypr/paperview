/** Represents a resolved PDF outline / bookmark item. */
export interface OutlineItem {
  title: string;
  /** 1-based page number, null if destination could not be resolved */
  page: number | null;
  children: OutlineItem[];
}
