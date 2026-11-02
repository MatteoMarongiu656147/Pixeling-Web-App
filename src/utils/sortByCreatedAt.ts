/** Sorts content by valid creation dates while keeping undated items visible. 
 * Used by:
 * - artworkService
 * - projectService
 * - spriteService
 * to sort the content
*/
export function sortByCreatedAtNewestFirst<T extends { createdAt?: string }>(
  items: T[]
): T[] {
  // Keep each original position so equal or invalid dates stay in a stable order.
  return items
    .map((item, originalIndex) => {
      const timestamp = item.createdAt ? Date.parse(item.createdAt) : Number.NaN;

      return {
        item,
        originalIndex,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
      };
    })
    .sort((firstEntry, secondEntry) => {
      if (firstEntry.timestamp === null && secondEntry.timestamp === null) {
        return firstEntry.originalIndex - secondEntry.originalIndex;
      }

      if (firstEntry.timestamp === null) {
        return 1;
      }

      if (secondEntry.timestamp === null) {
        return -1;
      }

      return (
        secondEntry.timestamp - firstEntry.timestamp ||
        firstEntry.originalIndex - secondEntry.originalIndex
      );
    })
    .map((entry) => entry.item);
}
