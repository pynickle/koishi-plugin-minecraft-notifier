export function generateArticleUrl(version: string): string {
    const baseUrl = 'https://www.minecraft.net/en-us/article';

    const normalizedVersion = version.trim().toLowerCase().replace(/\s+/g, '');

    const urlVersion = normalizedVersion.replaceAll('.', '-');

    if (normalizedVersion.includes('-snapshot-')) {
        return `${baseUrl}/minecraft-${urlVersion}`;
    }

    return `${baseUrl}/minecraft-java-edition-${urlVersion}`;
}
