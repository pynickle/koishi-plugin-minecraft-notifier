export function generateArticleUrl(version: string): string {
  const baseUrl = 'https://www.minecraft.net/en-us/article';

  const normalizedVersion = version.trim().toLowerCase().replace(/\s+/g, '');

  const urlVersion = normalizedVersion.replaceAll('.', '-');

  if (normalizedVersion.includes('-snapshot-')) {
    return `${baseUrl}/minecraft-${urlVersion}`;
  }
  if (normalizedVersion.includes('-pre-')) {
    return `${baseUrl}/minecraft-${urlVersion.replace('pre', 'pre-release')}`;
  }

  return `${baseUrl}/minecraft-java-edition-${urlVersion}`;
}
