import { Filter } from 'glin-profanity';

const profanityFilter = new Filter({
    languages: ['french', 'english'],
    detectLeetspeak: true,
    leetspeakLevel: 'aggressive',
    normalizeUnicode: true,
    customWords: ['hitler', 'nazi', 'fasciste', 'dictateur', 'tyran', 'stalin', 'mao', 'lenin', 'fdp'],
});

export function validatePlayerName(name: string): boolean {
    const trimmedName = name.trim();

    if (trimmedName.length === 0 || trimmedName.length > 20) {
        return false;
    }

    const lowerCaseName = trimmedName.toLowerCase();
    if (profanityFilter.isProfane(lowerCaseName)) {
        return false;
    }

    return true;
}
