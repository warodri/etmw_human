import type { TaggedComponent, WordCategory } from "../types/tagging.js";

function component(
  word: string,
  lemma: string,
  category: WordCategory
): TaggedComponent {
  return { word, lemma, category };
}

function pronoun(word: string, lemma = word): TaggedComponent {
  return component(word, lemma, "personal pronoun");
}

function objectPronoun(word: string, lemma = word): TaggedComponent {
  return component(word, lemma, "object pronoun");
}

function auxiliary(word: string, lemma: string): TaggedComponent {
  return component(word, lemma, "auxiliary verb");
}

function modal(word: string, lemma: string): TaggedComponent {
  return component(word, lemma, "modal verb");
}

function semiModal(word: string, lemma: string): TaggedComponent {
  return component(word, lemma, "semi-modal");
}

function negation(): TaggedComponent {
  return component("not", "not", "negation");
}

export const contractions: Readonly<Record<string, readonly TaggedComponent[]>> = {
  "i'm": [pronoun("I", "i"), auxiliary("am", "be")],
  "you're": [pronoun("you"), auxiliary("are", "be")],
  "he's": [pronoun("he"), auxiliary("is", "be")],
  "she's": [pronoun("she"), auxiliary("is", "be")],
  "it's": [pronoun("it"), auxiliary("is", "be")],
  "we're": [pronoun("we"), auxiliary("are", "be")],
  "they're": [pronoun("they"), auxiliary("are", "be")],
  "i've": [pronoun("I", "i"), auxiliary("have", "have")],
  "you've": [pronoun("you"), auxiliary("have", "have")],
  "we've": [pronoun("we"), auxiliary("have", "have")],
  "they've": [pronoun("they"), auxiliary("have", "have")],
  "i'd": [pronoun("I", "i"), modal("would", "would")],
  "you'd": [pronoun("you"), modal("would", "would")],
  "he'd": [pronoun("he"), modal("would", "would")],
  "she'd": [pronoun("she"), modal("would", "would")],
  "we'd": [pronoun("we"), modal("would", "would")],
  "they'd": [pronoun("they"), modal("would", "would")],
  "i'll": [pronoun("I", "i"), modal("will", "will")],
  "you'll": [pronoun("you"), modal("will", "will")],
  "he'll": [pronoun("he"), modal("will", "will")],
  "she'll": [pronoun("she"), modal("will", "will")],
  "we'll": [pronoun("we"), modal("will", "will")],
  "they'll": [pronoun("they"), modal("will", "will")],
  "isn't": [auxiliary("is", "be"), negation()],
  "aren't": [auxiliary("are", "be"), negation()],
  "wasn't": [auxiliary("was", "be"), negation()],
  "weren't": [auxiliary("were", "be"), negation()],
  "don't": [auxiliary("do", "do"), negation()],
  "doesn't": [auxiliary("does", "do"), negation()],
  "didn't": [auxiliary("did", "do"), negation()],
  "haven't": [auxiliary("have", "have"), negation()],
  "hasn't": [auxiliary("has", "have"), negation()],
  "hadn't": [auxiliary("had", "have"), negation()],
  "can't": [modal("can", "can"), negation()],
  "cannot": [modal("can", "can"), negation()],
  "couldn't": [modal("could", "could"), negation()],
  "won't": [modal("will", "will"), negation()],
  "wouldn't": [modal("would", "would"), negation()],
  "shouldn't": [modal("should", "should"), negation()],
  "mustn't": [modal("must", "must"), negation()],
  "mightn't": [modal("might", "might"), negation()],
  "needn't": [semiModal("need", "need"), negation()],
  "shan't": [modal("shall", "shall"), negation()],
  "let's": [component("let", "let", "main verb"), objectPronoun("us", "us")],
  "there's": [component("there", "there", "locative adverb"), auxiliary("is", "be")],
  "here's": [component("here", "here", "locative adverb"), auxiliary("is", "be")],
  "that's": [component("that", "that", "demonstrative pronoun"), auxiliary("is", "be")],
  "what's": [component("what", "what", "interrogative pronoun"), auxiliary("is", "be")],
  "who's": [component("who", "who", "interrogative pronoun"), auxiliary("is", "be")],
  "where's": [component("where", "where", "interrogative adverb"), auxiliary("is", "be")],
  "how's": [component("how", "how", "interrogative adverb"), auxiliary("is", "be")]
};
