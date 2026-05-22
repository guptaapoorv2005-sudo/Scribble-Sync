import wordsData from "../words/words.json";

const normalizeWord = (word: string): string => {
  return word.replace(/\s+/g, " ").trim();
};

export class WordService {
  private readonly words: string[];

  constructor() {
    const raw = Array.isArray(wordsData) ? wordsData : [];
    this.words = raw.map((word) => normalizeWord(String(word))).filter(Boolean);

    if (!this.words.length) {
      this.words.push("tree", "house", "river", "pencil", "planet");
    }
  }

  public getRandomWords(count: number): string[] {
    const unique = new Set<string>();
    const target = Math.max(1, Math.min(count, this.words.length));

    while (unique.size < target) {
      const index = Math.floor(Math.random() * this.words.length);
      unique.add(this.words[index]);
    }

    return Array.from(unique.values());
  }

  public getMaskedWord(word: string, revealedIndices: Set<number>): string {
    const chars = word.split("");
    const masked = chars.map((char, index) => {
      if (char === " ") return " ";
      if (revealedIndices.has(index)) return char;
      return "_";
    });

    return masked.join(" ");
  }

  public revealRandomLetter(
    word: string,
    revealedIndices: Set<number>,
    maxHints: number
  ): boolean {
    const letters = word.split("");
    const vowels = new Set(["a", "e", "i", "o", "u"]);

    const letterIndices = letters
      .map((char, index) => ({ char, index }))
      .filter(({ char }) => char !== " ");

    const maxRevealable = Math.max(0, letterIndices.length - 1);
    const maxAllowed = Math.min(maxHints, maxRevealable);
    if (revealedIndices.size >= maxAllowed) return false;

    const revealable = letterIndices.filter(
      ({ index }) => !revealedIndices.has(index)
    );
    if (!revealable.length) return false;

    const vowelIndices = revealable
      .filter(({ char }) => vowels.has(char.toLowerCase()))
      .map(({ index }) => index);
    const consonantIndices = revealable
      .filter(({ char }) => !vowels.has(char.toLowerCase()))
      .map(({ index }) => index);

    const preferConsonant = Math.random() < 0.6;
    const pool =
      preferConsonant && consonantIndices.length
        ? consonantIndices
        : vowelIndices.length
          ? vowelIndices
          : consonantIndices;

    if (!pool.length) return false;

    const pickIndex = pool[Math.floor(Math.random() * pool.length)];
    revealedIndices.add(pickIndex);
    return true;
  }

  public normalize(word: string): string {
    return normalizeWord(word).toLowerCase();
  }
}
