export const menuImageFilename = /^[a-f0-9-]{36}\.webp$/;
export const menuImageMaxBytes = 2 * 1024 * 1024;

export function menuImagePath(key?: string | null) {
  return key && menuImageFilename.test(key) ? "/menu-images/" + key : undefined;
}
