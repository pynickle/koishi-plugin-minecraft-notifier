export function generateArticleUrl(
    version: string,
    isSnapshot: boolean
): string {
    const cleanVersion = version.replace(/\s/g, '-').toLowerCase();
    const baseUrl = 'https://www.minecraft.net/zh-hans/article';

    if (isSnapshot) {
        return generateSnapshotUrl(baseUrl, version, cleanVersion);
    }

    return `${baseUrl}/minecraft-java-edition-${cleanVersion.replaceAll('.', '-')}`;
}

function generateSnapshotUrl(
    baseUrl: string,
    version: string,
    cleanVersion: string
): string {
    if (version.includes('rc')) {
        return buildReleaseUrl(baseUrl, version, 'release-candidate');
    }

    if (version.includes('pre')) {
        return buildReleaseUrl(baseUrl, version, 'pre-release');
    }

    return `${baseUrl}/minecraft-snapshot-${cleanVersion}`;
}

function buildReleaseUrl(
    baseUrl: string,
    version: string,
    releaseType: string
): string {
    const [mainVersion] = version.split('-');
    const buildNumber = version.slice(-1);
    const formattedVersion = mainVersion.replaceAll('.', '-');

    return `${baseUrl}/minecraft-${formattedVersion}-${releaseType}-${buildNumber}`;
}
