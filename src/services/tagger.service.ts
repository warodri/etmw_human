import { contractions as contractionMap } from "../data/contractions.js";
import type { LexiconRepository } from "../repositories/lexicon.repository.js";
import type {
  TaggedComponent,
  TaggedToken,
  TaggingResult,
  WordCategory
} from "../types/tagging.js";
import { tokenize, type RawToken } from "./tokenizer.service.js";

interface LookupResult {
  lemma: string;
  categories: WordCategory[];
}

interface PreparedToken {
  raw: RawToken;
  lookup?: LookupResult;
  contraction?: readonly TaggedComponent[];
}

interface UnknownResult {
  lemma: string;
  category: WordCategory;
}

const pureVerbCategories = new Set<WordCategory>([
  "auxiliary verb",
  "modal verb",
  "semi-modal",
  "main verb"
]);

const subjectCategories = new Set<WordCategory>([
  "personal pronoun",
  "object pronoun",
  "possessive pronoun",
  "reflexive pronoun",
  "reciprocal pronoun",
  "indefinite pronoun",
  "demonstrative pronoun",
  "relative pronoun",
  "interrogative pronoun",
  "noun"
]);

const determinerCategories = new Set<WordCategory>([
  "article",
  "possessive determiner",
  "demonstrative determiner",
  "quantifier",
  "distributive",
  "predeterminer",
  "ordinal",
  "cardinal number"
]);

const adverbCategories = new Set<WordCategory>([
  "adverb",
  "linking adverb",
  "degree adverb",
  "frequency adverb",
  "locative adverb",
  "interrogative adverb",
  "relative adverb"
]);

const nominalCategories = new Set<WordCategory>([
  "noun",
  "adjective",
  "ordinal",
  "cardinal number"
]);

const clauseStarterCategories = new Set<WordCategory>([
  "personal pronoun",
  "object pronoun",
  "possessive pronoun",
  "reflexive pronoun",
  "reciprocal pronoun",
  "indefinite pronoun",
  "demonstrative pronoun",
  "relative pronoun",
  "interrogative pronoun",
  "auxiliary verb",
  "modal verb",
  "semi-modal"
]);

const beForms = new Set(["be", "am", "is", "are", "was", "were", "been", "being"]);
const modals = new Set([
  "can",
  "could",
  "may",
  "might",
  "must",
  "shall",
  "should",
  "will",
  "would"
]);
const coreResponses = new Set([
  "yes",
  "no",
  "yeah",
  "yep",
  "nope",
  "okay",
  "ok",
  "alright",
  "sure",
  "perhaps",
  "maybe"
]);
const beAdjectiveVerbs = new Set(["be", "am", "is", "are", "was", "were", "been", "being"]);

const fallbackPriority: WordCategory[] = [
  "personal pronoun",
  "object pronoun",
  "possessive determiner",
  "possessive pronoun",
  "reflexive pronoun",
  "reciprocal pronoun",
  "indefinite pronoun",
  "demonstrative pronoun",
  "relative pronoun",
  "interrogative pronoun",
  "article",
  "demonstrative determiner",
  "predeterminer",
  "quantifier",
  "distributive",
  "auxiliary verb",
  "modal verb",
  "semi-modal",
  "coordinating conjunction",
  "subordinating conjunction",
  "correlative conjunction",
  "preposition",
  "complex preposition",
  "interrogative adverb",
  "relative adverb",
  "negation",
  "particle",
  "linking adverb",
  "degree adverb",
  "frequency adverb",
  "interjection",
  "response word",
  "ordinal",
  "cardinal number",
  "contraction",
  "locative adverb",
  "focusing particle",
  "noun",
  "main verb",
  "adjective",
  "adverb",
  "infinitive marker",
  "punctuation",
  "unknown"
];

const pastParticiples = new Set([
  "eaten", "gone", "seen", "done", "been", "had", "made", "taken", "given",
  "written", "spoken", "broken", "chosen", "driven", "known", "run", "come",
  "become", "begun", "brought", "bought", "caught", "thought", "found", "got",
  "gotten", "left", "lost", "met", "paid", "read", "said", "sold", "sent",
  "told", "understood", "worn", "won", "built", "felt", "kept", "slept",
  "swum", "flown", "grown", "thrown", "shown", "blown", "drawn", "fallen",
  "forgotten", "hidden", "ridden", "risen", "shaken", "stolen", "struck",
  "torn", "woken", "laid", "led", "fed", "fought", "held", "hung", "hurt",
  "put", "set", "shut", "cut", "spent", "stood", "swum", "worn"
]);

const irregularLemmas: Readonly<Record<string, string>> = {
  am: "be",
  is: "be",
  are: "be",
  was: "be",
  were: "be",
  been: "be",
  being: "be",
  has: "have",
  had: "have",
  having: "have",
  does: "do",
  did: "do",
  done: "do",
  doing: "do",
  eaten: "eat",
  gone: "go",
  went: "go",
  seen: "see",
  saw: "see",
  bought: "buy",
  built: "build",
  made: "make",
  taken: "take",
  took: "take",
  gave: "give",
  given: "give",
  got: "get",
  gotten: "get",
  came: "come",
  became: "become",
  began: "begin",
  begun: "begin",
  ran: "run",
  drank: "drink",
  drunk: "drink",
  wrote: "write",
  written: "write",
  spoke: "speak",
  spoken: "speak",
  said: "say",
  told: "tell",
  thought: "think",
  knew: "know",
  known: "know",
  felt: "feel",
  left: "leave",
  kept: "keep",
  slept: "sleep",
  woke: "wake",
  woken: "wake",
  flew: "fly",
  flown: "fly",
  swam: "swim",
  swum: "swim",
  won: "win",
  lost: "lose",
  sent: "send",
  met: "meet",
  paid: "pay",
  sold: "sell",
  taught: "teach",
  understood: "understand",
  forgot: "forget",
  forgotten: "forget",
  chose: "choose",
  chosen: "choose",
  drove: "drive",
  driven: "drive",
  broke: "break",
  broken: "break",
  grew: "grow",
  grown: "grow",
  threw: "throw",
  thrown: "throw",
  wore: "wear",
  worn: "wear",
  rose: "rise",
  risen: "rise",
  shook: "shake",
  shaken: "shake",
  stole: "steal",
  stolen: "steal",
  lay: "lay",
  laid: "lay",
  led: "lead",
  fed: "feed",
  fought: "fight",
  found: "find",
  held: "hold",
  hung: "hang",
  hid: "hide",
  hidden: "hide",
  hit: "hit",
  hurt: "hurt",
  let: "let",
  put: "put",
  set: "set",
  shut: "shut",
  cut: "cut",
  read: "read",
  spent: "spend",
  stood: "stand",
  struck: "strike",
  tore: "tear",
  torn: "tear"
};

export class Tagger {
  constructor(private readonly lexicon: LexiconRepository) {}

  tag(input: string): TaggingResult {
    const rawTokens = tokenize(input);
    const prepared = rawTokens.map<PreparedToken>((raw) => {
      if (raw.isPunctuation) {
        return { raw };
      }

      const contraction = contractionMap[raw.lower];
      if (contraction) {
        return { raw, contraction };
      }

      return { raw, lookup: this.lookup(raw.lower) };
    });

    const sentenceHasQuestionMark = rawTokens.some(
      (token) => token.lower === "?"
    );
    const tagged: TaggedToken[] = [];

    for (let index = 0; index < prepared.length; index += 1) {
      const item = prepared[index]!;
      const raw = item.raw;

      if (raw.isPunctuation) {
        tagged.push(this.buildToken(raw, "punctuation", raw.normalized, 1));
        continue;
      }

      if (item.contraction) {
        const primary = item.contraction[0]!;
        tagged.push({
          ...this.buildToken(raw, primary.category, primary.lemma, 1),
          isContraction: true,
          components: [...item.contraction]
        });
        continue;
      }

      if (item.lookup) {
        const category = this.resolveCategory(
          prepared,
          tagged,
          index,
          item.lookup.categories,
          sentenceHasQuestionMark
        );

        tagged.push(
          this.buildToken(
            raw,
            category,
            item.lookup.lemma,
            item.lookup.categories.length === 1 ? 0.99 : 0.9
          )
        );
        continue;
      }

      const inferred = this.inferUnknown(prepared, tagged, index);
      tagged.push(this.buildToken(raw, inferred.category, inferred.lemma, 0.55));
    }

    const summary: Record<string, number> = {};
    let wordCount = 0;

    for (const token of tagged) {
      if (token.category === "punctuation") {
        continue;
      }

      wordCount += 1;
      summary[token.category] = (summary[token.category] ?? 0) + 1;
    }

    const sentenceCount =
      tagged.filter(
        (token) =>
          token.category === "punctuation" && /[.!?]/.test(token.word)
      ).length || (tagged.length > 0 ? 1 : 0);

    return {
      sentence: input,
      tokens: tagged,
      summary,
      stats: {
        tokenCount: tagged.length,
        wordCount,
        sentenceCount
      }
    };
  }

  private buildToken(
    raw: RawToken,
    category: WordCategory,
    lemma: string,
    confidence: number
  ): TaggedToken {
    return {
      word: raw.text,
      normalized: raw.normalized,
      lemma,
      category,
      confidence,
      start: raw.start,
      end: raw.end,
      isContraction: false,
      components: []
    };
  }

  private lookup(word: string): LookupResult | undefined {
    const direct = this.lexicon.findByWord(word);

    if (direct) {
      return {
        lemma: direct.lemma,
        categories: [...direct.categories]
      };
    }

    return this.lookupMorphology(word);
  }

  private lookupMorphology(word: string): LookupResult | undefined {
    if (/^\d+(?:[.,]\d+)?$/.test(word)) {
      return {
        lemma: word.replace(",", "."),
        categories: ["cardinal number"]
      };
    }

    const irregular = irregularLemmas[word];
    if (irregular) {
      const entry = this.lexicon.findByWord(irregular);
      if (entry) {
        return {
          lemma: irregular,
          categories: [...entry.categories]
        };
      }
    }

    if (word.endsWith("ly") && word.length > 3) {
      const base = word.slice(0, -2);
      const entry = this.lexicon.findByWord(base);
      return {
        lemma: entry?.lemma ?? base,
        categories: ["adverb"]
      };
    }

    const candidateLemmas = new Set<string>();

    const add = (lemma: string): void => {
      if (lemma.length >= 2) {
        candidateLemmas.add(lemma);
      }
    };

    if (word.endsWith("ies") && word.length > 4) {
      add(`${word.slice(0, -3)}y`);
    }

    if (word.endsWith("ves") && word.length > 4) {
      add(`${word.slice(0, -3)}f`);
      add(`${word.slice(0, -3)}fe`);
    }

    if (word.endsWith("es") && word.length > 3) {
      add(word.slice(0, -2));
      add(word.slice(0, -1));
    }

    if (word.endsWith("s") && !word.endsWith("ss") && word.length > 2) {
      add(word.slice(0, -1));
    }

    if (word.endsWith("ied") && word.length > 4) {
      add(`${word.slice(0, -3)}y`);
    }

    if (word.endsWith("ed") && word.length > 3) {
      add(word.slice(0, -2));
      add(word.slice(0, -1));

      const stem = word.slice(0, -2);
      if (
        stem.length > 2 &&
        stem.at(-1) === stem.at(-2)
      ) {
        add(stem.slice(0, -1));
      }
    }

    if (word.endsWith("ing") && word.length > 4) {
      const stem = word.slice(0, -3);
      add(stem);
      add(`${stem}e`);

      if (
        stem.length > 2 &&
        stem.at(-1) === stem.at(-2)
      ) {
        add(stem.slice(0, -1));
      }
    }

    if (word.endsWith("ier") && word.length > 4) {
      add(`${word.slice(0, -3)}y`);
    }

    if (word.endsWith("iest") && word.length > 5) {
      add(`${word.slice(0, -4)}y`);
    }

    if (word.endsWith("er") && word.length > 3) {
      add(word.slice(0, -2));
    }

    if (word.endsWith("est") && word.length > 4) {
      add(word.slice(0, -3));
    }

    const categories = new Set<WordCategory>();
    let firstLemma: string | undefined;

    for (const lemma of candidateLemmas) {
      const entry = this.lexicon.findByWord(lemma);

      if (!entry) {
        continue;
      }

      firstLemma ??= lemma;

      for (const category of entry.categories) {
        categories.add(category);
      }
    }

    if (firstLemma && categories.size > 0) {
      return {
        lemma: firstLemma,
        categories: [...categories]
      };
    }

    return undefined;
  }

  private resolveCategory(
    prepared: PreparedToken[],
    tagged: TaggedToken[],
    index: number,
    candidates: WordCategory[],
    sentenceHasQuestionMark: boolean
  ): WordCategory {
    const lower = prepared[index]!.raw.lower;
    const prev = tagged[index - 1];
    const prevCat = prev?.category;
    const atStart = this.isAtSentenceStart(tagged, index);
    const next = this.nextWord(prepared, index, 1);
    const next2 = this.nextWord(prepared, index, 2);
    const nextCats = this.categoriesAt(prepared, index + 1);
    const next2Cats = this.categoriesAt(prepared, index + 2);
    const nextLower = next?.lower;
    const next2Lower = next2?.lower;
    const has = (category: WordCategory): boolean =>
      candidates.includes(category);
    const nextIsNominal = nextCats.some((category) =>
      nominalCategories.has(category)
    );
    const nextIsVerbish = nextCats.some((category) =>
      pureVerbCategories.has(category)
    );
    const nextIsClauseStart = nextCats.some((category) =>
      clauseStarterCategories.has(category)
    );
    const next2IsVerbish = next2Cats.some((category) =>
      pureVerbCategories.has(category)
    );
    const clauseHasMainVerb = this.clauseHasMainVerb(tagged, index);

    if (beForms.has(lower)) {
      return "auxiliary verb";
    }

    if (modals.has(lower)) {
      return "modal verb";
    }

    if (lower === "that") {
      if (nextIsNominal && !nextIsVerbish) {
        return "demonstrative determiner";
      }

      if (prevCat === "noun") {
        return "relative pronoun";
      }

      if (
        prevCat &&
        ["main verb", "auxiliary verb", "modal verb", "semi-modal"].includes(
          prevCat
        ) &&
        nextIsClauseStart
      ) {
        return "subordinating conjunction";
      }

      if (lower === "that" && prevCat === "preposition") {
        return "demonstrative pronoun";
      }

      if (has("demonstrative pronoun")) {
        return "demonstrative pronoun";
      }

      if (has("relative pronoun")) {
        return "relative pronoun";
      }

      return "demonstrative pronoun";
    }

    if (["this", "these", "those"].includes(lower)) {
      if (nextIsNominal && !nextIsVerbish) {
        return "demonstrative determiner";
      }

      return "demonstrative pronoun";
    }

    if (["who", "whom", "whose"].includes(lower)) {
      if (
        atStart ||
        prevCat === "preposition" ||
        prevCat === "auxiliary verb" ||
        prevCat === "modal verb"
      ) {
        return "interrogative pronoun";
      }

      if (prevCat && subjectCategories.has(prevCat)) {
        return "relative pronoun";
      }

      return "interrogative pronoun";
    }

    if (lower === "which") {
      if (atStart) {
        return "interrogative pronoun";
      }

      if (prevCat && subjectCategories.has(prevCat)) {
        return "relative pronoun";
      }

      if (prevCat === "preposition" || prevCat === "main verb") {
        return "interrogative pronoun";
      }

      return "relative pronoun";
    }

    if (lower === "what") {
      if (nextLower === "a" || nextLower === "an") {
        return "predeterminer";
      }

      if (atStart) {
        return "interrogative pronoun";
      }

      if (prevCat && subjectCategories.has(prevCat)) {
        return "relative pronoun";
      }

      return "interrogative pronoun";
    }

    if (["when", "where"].includes(lower)) {
      if (atStart) {
        if (sentenceHasQuestionMark) {
          return "interrogative adverb";
        }

        if (nextIsClauseStart) {
          return "subordinating conjunction";
        }

        return "interrogative adverb";
      }

      if (prevCat === "noun") {
        return "relative adverb";
      }

      if (nextIsClauseStart) {
        return "subordinating conjunction";
      }

      return "relative adverb";
    }

    if (lower === "why") {
      if (atStart) {
        return "interrogative adverb";
      }

      if (prevCat === "noun") {
        return "relative adverb";
      }

      return "interrogative adverb";
    }

    if (lower === "how") {
      return "interrogative adverb";
    }

    if (["do", "does", "did"].includes(lower)) {
      const nextIsNegation =
        nextCats.includes("negation") ||
        nextLower === "not" ||
        nextLower === "n't";
      const subjectThenVerb =
        nextCats.some((category) => subjectCategories.has(category)) &&
        next2IsVerbish;
      const adverbThenVerb =
        nextCats.some((category) => adverbCategories.has(category)) &&
        next2IsVerbish;

      if (
        nextIsNegation ||
        subjectThenVerb ||
        adverbThenVerb ||
        nextCats.includes("main verb") ||
        nextCats.includes("auxiliary verb")
      ) {
        return "auxiliary verb";
      }

      if (
        nextCats.some(
          (category) =>
            determinerCategories.has(category) ||
            ["noun", "adjective", "personal pronoun", "object pronoun"].includes(
              category
            )
        )
      ) {
        return "main verb";
      }

      if (!next) {
        return "main verb";
      }

      return has("auxiliary verb") ? "auxiliary verb" : "main verb";
    }

    if (["have", "has", "had"].includes(lower)) {
      if (nextLower === "to" || nextLower === "better") {
        return "semi-modal";
      }

      const nextIsParticiple =
        Boolean(nextLower) &&
        (pastParticiples.has(nextLower!) ||
          nextLower!.endsWith("ed") ||
          nextLower!.endsWith("en"));

      if (nextIsParticiple) {
        return "auxiliary verb";
      }

      const next2IsParticiple =
        Boolean(next2Lower) &&
        (pastParticiples.has(next2Lower!) ||
          next2Lower!.endsWith("ed") ||
          next2Lower!.endsWith("en"));

      if (
        nextCats.some((category) => adverbCategories.has(category)) &&
        next2IsParticiple
      ) {
        return "auxiliary verb";
      }

      if (
        nextCats.some(
          (category) =>
            determinerCategories.has(category) ||
            [
              "noun",
              "adjective",
              "personal pronoun",
              "object pronoun",
              "indefinite pronoun"
            ].includes(category)
        )
      ) {
        return "main verb";
      }

      if (!next) {
        return "main verb";
      }

      if (
        prevCat &&
        ["auxiliary verb", "modal verb", "semi-modal"].includes(prevCat)
      ) {
        return "auxiliary verb";
      }

      return "main verb";
    }

    if (lower === "need" || lower === "dare") {
      if (nextLower === "to") {
        return "semi-modal";
      }

      if (nextCats.includes("negation")) {
        return "semi-modal";
      }

      return "main verb";
    }

    if (lower === "ought") {
      return nextLower === "to" ? "semi-modal" : "modal verb";
    }

    if (lower === "used") {
      return nextLower === "to" ? "semi-modal" : "main verb";
    }

    if (lower === "to") {
      if (
        nextCats.some((category) => pureVerbCategories.has(category)) ||
        nextLower === "be" ||
        nextLower === "have" ||
        nextLower === "not"
      ) {
        return "infinitive marker";
      }

      if (
        nextCats.some((category) => adverbCategories.has(category)) &&
        next2IsVerbish
      ) {
        return "infinitive marker";
      }

      return "preposition";
    }

    if (lower === "not" || lower === "n't") {
      return "negation";
    }

    if (lower === "never") {
      return "frequency adverb";
    }

    if (lower === "no") {
      if (atStart) {
        return "response word";
      }

      if (
        nextCats.some(
          (category) =>
            nominalCategories.has(category) || category === "article"
        )
      ) {
        return "negation";
      }

      if (
        prevCat &&
        ["main verb", "auxiliary verb", "modal verb", "semi-modal"].includes(
          prevCat
        )
      ) {
        return "response word";
      }

      return "negation";
    }

    if (has("response word")) {
      if (coreResponses.has(lower)) {
        return "response word";
      }

      if (
        ["right", "correct", "wrong"].includes(lower) &&
        nextIsNominal &&
        !nextIsVerbish
      ) {
        return "adjective";
      }

      if (has("linking adverb")) {
        return "linking adverb";
      }

      if (has("degree adverb")) {
        return "degree adverb";
      }

      if (has("adverb")) {
        return "adverb";
      }

      return "response word";
    }

    if (lower === "her") {
      return nextIsNominal && !nextIsVerbish
        ? "possessive determiner"
        : "object pronoun";
    }

    if (lower === "his") {
      return nextIsNominal && !nextIsVerbish
        ? "possessive determiner"
        : "possessive pronoun";
    }

    if (lower === "its") {
      return "possessive determiner";
    }

    if (
      ["my", "your", "our", "their"].includes(lower) ||
      lower === "her"
    ) {
      return "possessive determiner";
    }

    if (["mine", "yours", "hers", "ours", "theirs"].includes(lower)) {
      return "possessive pronoun";
    }

    if (["me", "him", "us", "them"].includes(lower)) {
      return "object pronoun";
    }

    if (["i", "you", "he", "she", "it", "we", "they"].includes(lower)) {
      return "personal pronoun";
    }

    if (lower === "very") {
      return "degree adverb";
    }

    if (lower === "too") {
      return nextCats.some(
        (category) =>
          category === "adjective" || category === "adverb"
      )
        ? "degree adverb"
        : "focusing particle";
    }

    if (lower === "just") {
      if (
        nextCats.some(
          (category) =>
            category === "adjective" || category === "adverb"
        )
      ) {
        return "degree adverb";
      }

      if (nextIsVerbish) {
        return "adverb";
      }

      return "focusing particle";
    }

    if (lower === "pretty") {
      if (
        nextCats.some(
          (category) =>
            category === "adjective" || category === "adverb"
        )
      ) {
        return "degree adverb";
      }

      if (nextIsNominal) {
        return "adjective";
      }

      return "degree adverb";
    }

    if (lower === "quite" || lower === "rather") {
      if (
        nextCats.some(
          (category) =>
            determinerCategories.has(category) || category === "article"
        )
      ) {
        return "predeterminer";
      }

      return "degree adverb";
    }

    if (lower === "such") {
      return "predeterminer";
    }

    if (lower === "enough") {
      return nextIsNominal ? "quantifier" : "degree adverb";
    }

    if (
      ["only", "even", "merely", "solely", "especially", "particularly", "simply"].includes(
        lower
      )
    ) {
      return "focusing particle";
    }

    if (lower === "also") {
      return atStart && has("linking adverb")
        ? "linking adverb"
        : "focusing particle";
    }

    if (lower === "all" || lower === "both" || lower === "half") {
      if (
        nextCats.some(
          (category) =>
            determinerCategories.has(category) ||
            nominalCategories.has(category) ||
            category === "article"
        )
      ) {
        return "predeterminer";
      }

      return has("indefinite pronoun") ? "indefinite pronoun" : "predeterminer";
    }

    if (["each", "every", "either", "neither"].includes(lower)) {
      if (
        nextCats.some(
          (category) =>
            determinerCategories.has(category) || nominalCategories.has(category)
        )
      ) {
        return "distributive";
      }

      return has("indefinite pronoun") ? "indefinite pronoun" : "distributive";
    }

    if (
      ["more", "most", "less", "least"].includes(lower) &&
      nextCats.some(
        (category) => category === "adjective" || category === "adverb"
      )
    ) {
      return "degree adverb";
    }

    if (
      ["some", "any", "many", "much", "more", "most", "few", "little", "several"].includes(
        lower
      )
    ) {
      return has("quantifier") ? "quantifier" : "predeterminer";
    }

    if (lower === "one" && nextLower === "of") {
      return "indefinite pronoun";
    }

    if (lower === "so") {
      if (
        nextCats.some(
          (category) => category === "adjective" || category === "adverb"
        )
      ) {
        return "degree adverb";
      }

      return "coordinating conjunction";
    }

    if (lower === "for") {
      return "preposition";
    }

    if (lower === "as") {
      if (
        nextCats.some((category) => subjectCategories.has(category)) ||
        nextCats.some((category) => pureVerbCategories.has(category))
      ) {
        return "subordinating conjunction";
      }

      return "preposition";
    }

    if (
      ["since", "before", "after", "until", "than"].includes(lower)
    ) {
      if (
        nextCats.some((category) => subjectCategories.has(category)) ||
        nextCats.some((category) => pureVerbCategories.has(category))
      ) {
        return "subordinating conjunction";
      }

      return "preposition";
    }

    if (lower === "yet") {
      if (
        prevCat &&
        ["negation", "auxiliary verb", "modal verb"].includes(prevCat) &&
        !next
      ) {
        return "adverb";
      }

      return "coordinating conjunction";
    }

    if (lower === "like") {
      if (
        prevCat &&
        ["auxiliary verb", "modal verb", "semi-modal"].includes(prevCat)
      ) {
        return "main verb";
      }

      if (prevCat && pureVerbCategories.has(prevCat)) {
        return "preposition";
      }

      if (
        prevCat &&
        (subjectCategories.has(prevCat) || prevCat === "punctuation")
      ) {
        return "main verb";
      }

      if (atStart) {
        return "main verb";
      }

      return "preposition";
    }

    if (lower === "well") {
      if (atStart && has("interjection")) {
        return "interjection";
      }

      if (prevCat === "auxiliary verb") {
        return "adjective";
      }

      return "adverb";
    }

    if (["outside", "inside", "behind", "ahead"].includes(lower)) {
      if (
        nextCats.some(
          (category) =>
            determinerCategories.has(category) || category === "article"
        ) &&
        has("preposition")
      ) {
        return "preposition";
      }

      if (has("locative adverb")) {
        return "locative adverb";
      }

      return "preposition";
    }

    if (lower === "home") {
      if (prevCat && determinerCategories.has(prevCat)) {
        return "noun";
      }

      return "locative adverb";
    }

    if (has("locative adverb")) {
      return "locative adverb";
    }

    if (
      has("preposition") &&
      (nextCats.some(
        (category) =>
          determinerCategories.has(category) ||
          category === "article" ||
          category === "noun"
      ) ||
        prevCat === "auxiliary verb" ||
        atStart)
    ) {
      return "preposition";
    }

    if (
      has("particle") &&
      prevCat &&
      pureVerbCategories.has(prevCat) &&
      !next
    ) {
      return "particle";
    }

    if (has("coordinating conjunction")) {
      return "coordinating conjunction";
    }

    if (has("subordinating conjunction")) {
      return "subordinating conjunction";
    }

    if (has("interjection") && atStart) {
      return "interjection";
    }

    if (has("noun") && has("main verb")) {
      return this.resolveNounVerb(
        candidates,
        prevCat,
        nextCats,
        clauseHasMainVerb,
        atStart
      );
    }

    if (has("adjective") && has("main verb")) {
      if (prevCat === "auxiliary verb") {
        return beAdjectiveVerbs.has(prev?.normalized ?? "")
          ? "adjective"
          : "main verb";
      }

      if (
        prevCat &&
        ["modal verb", "semi-modal", "negation", "infinitive marker"].includes(
          prevCat
        )
      ) {
        return "main verb";
      }

      if (nextIsNominal) {
        return "adjective";
      }

      if (atStart || (prevCat && subjectCategories.has(prevCat))) {
        return "main verb";
      }

      return "adjective";
    }

    if (has("adjective") && has("noun")) {
      if (
        prevCat &&
        ["degree adverb", "linking adverb"].includes(prevCat)
      ) {
        return "adjective";
      }

      if (prevCat === "auxiliary verb") {
        return "adjective";
      }

      if (prevCat && determinerCategories.has(prevCat)) {
        return nextCats.includes("noun") ? "adjective" : "noun";
      }

      if (nextCats.includes("noun")) {
        return "adjective";
      }

      if (prevCat && subjectCategories.has(prevCat)) {
        return "adjective";
      }

      return has("adjective") ? "adjective" : "noun";
    }

    if (has("adjective") && has("adverb")) {
      if (prevCat && pureVerbCategories.has(prevCat)) {
        return "adverb";
      }

      if (nextCats.includes("noun")) {
        return "adjective";
      }

      if (prevCat && determinerCategories.has(prevCat)) {
        return "adjective";
      }

      if (nextIsVerbish) {
        return "adverb";
      }

      return "adjective";
    }

    if (has("noun") && has("adverb")) {
      if (prevCat && pureVerbCategories.has(prevCat)) {
        return "adverb";
      }

      if (prevCat && determinerCategories.has(prevCat)) {
        return "noun";
      }

      return "noun";
    }

    if (has("main verb")) {
      return "main verb";
    }

    for (const category of fallbackPriority) {
      if (candidates.includes(category)) {
        return category;
      }
    }

    return "unknown";
  }

  private resolveNounVerb(
    candidates: WordCategory[],
    prevCat: WordCategory | undefined,
    nextCats: WordCategory[],
    clauseHasMainVerb: boolean,
    atStart: boolean
  ): WordCategory {
    const hasNoun = candidates.includes("noun");
    const hasVerb = candidates.includes("main verb");

    if (
      prevCat &&
      ["auxiliary verb", "modal verb", "semi-modal", "negation", "infinitive marker"].includes(
        prevCat
      )
    ) {
      return "main verb";
    }

    if (prevCat && determinerCategories.has(prevCat)) {
      return "noun";
    }

    if (
      prevCat &&
      [
        "personal pronoun",
        "object pronoun",
        "possessive pronoun",
        "indefinite pronoun",
        "demonstrative pronoun",
        "relative pronoun",
        "interrogative pronoun",
        "reflexive pronoun",
        "reciprocal pronoun"
      ].includes(prevCat)
    ) {
      return clauseHasMainVerb ? (hasNoun ? "noun" : "main verb") : "main verb";
    }

    if (prevCat === "noun") {
      return clauseHasMainVerb ? (hasNoun ? "noun" : "main verb") : "main verb";
    }

    if (prevCat && pureVerbCategories.has(prevCat)) {
      return hasNoun ? "noun" : "main verb";
    }

    if (prevCat && adverbCategories.has(prevCat)) {
      return clauseHasMainVerb ? (hasNoun ? "noun" : "main verb") : "main verb";
    }

    if (atStart) {
      if (!nextCats.length && hasVerb) {
        return "main verb";
      }

      if (
        nextCats.some((category) =>
          ["personal pronoun", "object pronoun", "adverb"].includes(category)
        )
      ) {
        return "main verb";
      }

      return hasNoun ? "noun" : "main verb";
    }

    if (
      nextCats.some(
        (category) =>
          determinerCategories.has(category) ||
          ["noun", "personal pronoun", "object pronoun"].includes(category)
      )
    ) {
      return "main verb";
    }

    if (!clauseHasMainVerb && hasVerb) {
      return "main verb";
    }

    return hasNoun ? "noun" : "main verb";
  }

  private inferUnknown(
    prepared: PreparedToken[],
    tagged: TaggedToken[],
    index: number
  ): UnknownResult {
    const raw = prepared[index]!.raw;
    const lower = raw.lower;
    const prev = tagged[index - 1];
    const prevCat = prev?.category;
    const nextCats = this.categoriesAt(prepared, index + 1);
    const atStart = this.isAtSentenceStart(tagged, index);
    const clauseHasMainVerb = this.clauseHasMainVerb(tagged, index);

    if (/^\d+(?:[.,]\d+)?$/.test(lower)) {
      return { lemma: lower.replace(",", "."), category: "cardinal number" };
    }

    if (lower.endsWith("ly") && lower.length > 3) {
      return { lemma: lower.slice(0, -2), category: "adverb" };
    }

    if (prevCat && determinerCategories.has(prevCat)) {
      return { lemma: lower, category: "noun" };
    }

    if (
      prevCat &&
      ["auxiliary verb", "modal verb", "semi-modal", "negation", "infinitive marker"].includes(
        prevCat
      )
    ) {
      return { lemma: lower, category: "main verb" };
    }

    if (prevCat === "adjective" || prevCat === "preposition") {
      return { lemma: lower, category: "noun" };
    }

    if (prevCat === "noun" || (prevCat && subjectCategories.has(prevCat))) {
      return {
        lemma: lower,
        category: clauseHasMainVerb ? "noun" : "main verb"
      };
    }

    if (prevCat && pureVerbCategories.has(prevCat)) {
      return { lemma: lower, category: "noun" };
    }

    if (atStart) {
      if (nextCats.some((category) => pureVerbCategories.has(category))) {
        return { lemma: lower, category: "noun" };
      }

      return { lemma: lower, category: "noun" };
    }

    return { lemma: lower, category: "noun" };
  }

  private nextWord(
    prepared: PreparedToken[],
    index: number,
    offset: number
  ): RawToken | undefined {
    const item = prepared[index + offset];

    if (!item || item.raw.isPunctuation) {
      return undefined;
    }

    return item.raw;
  }

  private categoriesAt(
    prepared: PreparedToken[],
    index: number
  ): WordCategory[] {
    const item = prepared[index];

    if (!item || item.raw.isPunctuation) {
      return [];
    }

    if (item.contraction) {
      return item.contraction.map((component) => component.category);
    }

    return item.lookup?.categories ?? [];
  }

  private isAtSentenceStart(tagged: TaggedToken[], index: number): boolean {
    if (index === 0) {
      return true;
    }

    const previous = tagged[index - 1];

    if (!previous) {
      return true;
    }

    if (previous.category !== "punctuation") {
      return false;
    }

    return /[.!?;]/.test(previous.word);
  }

  private clauseHasMainVerb(tagged: TaggedToken[], index: number): boolean {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const token = tagged[cursor]!;

      if (token.category === "punctuation" && /[.!?;]/.test(token.word)) {
        break;
      }

      if (token.category === "main verb") {
        return true;
      }
    }

    return false;
  }

}
