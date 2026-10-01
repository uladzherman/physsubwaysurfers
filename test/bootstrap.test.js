import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SECTIONS } from "../assets/js/data/cards.js";
import { createQuizContent } from "../assets/js/quiz/questions.js";
import { loadSettings } from "../assets/js/core/settings.js";

test("app bootstrap connects settings to the real question catalog", () => {
  const content = createQuizContent(CARDS, SECTIONS, () => 0.5);
  const settings = loadSettings(content.sectionOrder, { getItem: () => null });
  const cardCount = CARDS.filter((card) => settings.sections.includes(card.s)).length;

  assert.equal(settings.sections.length, SECTIONS.length);
  assert.equal(cardCount, CARDS.length);
  assert.ok(cardCount > 0);
  assert.ok(SECTIONS.every((section) => content.sectionTitle[section.id] === section.title));
  assert.ok(SECTIONS.every((section) => content.buildDeck(section.id).length > 0));
});
