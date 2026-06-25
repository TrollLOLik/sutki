import { File, Paths } from 'expo-file-system';

function getFavoritesFile(): File {
  return new File(Paths.document, 'favorites.json');
}

export async function readLocalFavorites(): Promise<number[]> {
  try {
    const file = getFavoritesFile();
    if (!file.exists) {
      return [];
    }
    const content = await file.text();
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((id) => Number(id)).filter((id) => !isNaN(id));
    }
    return [];
  } catch (e) {
    console.error('Failed to read local favorites', e);
    return [];
  }
}

export function writeLocalFavorites(ids: number[]): void {
  try {
    const file = getFavoritesFile();
    file.write(JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to write local favorites', e);
  }
}
