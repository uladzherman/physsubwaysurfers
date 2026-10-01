import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SECTIONS } from "../assets/js/data/cards.js";
import { createQuizContent } from "../assets/js/quiz/questions.js";

const quiz = createQuizContent(CARDS, SECTIONS, () => 0.5);

test("physics data covers every declared section", () => {
  assert.equal(quiz.sectionOrder.length, SECTIONS.length);
  assert.ok(CARDS.length > 100);
  for (const card of CARDS) {
    assert.ok(quiz.sectionOrder.includes(card.s), `unknown section ${card.s}`);
    assert.ok(card.t && card.f, `incomplete card ${card.t}`);
  }
});

test("each section produces answerable formula questions", () => {
  for (const section of SECTIONS) {
    const deck = quiz.buildDeck(section.id);
    assert.ok(deck.length > 0, `empty question deck for ${section.id}`);
    for (const question of deck) {
      assert.equal(question.section, section.id);
      assert.equal(question.choices.length, 4);
      assert.equal(question.choices.filter((choice) => choice.ok).length, 1);
      assert.ok(question.choices.every((choice) => choice.tex));
    }
  }
});

test("unit questions retain their prompt and one correct unit", () => {
  const card = CARDS.find((item) => item.vars?.some((variable) => variable.u));
  const variable = card.vars.find((item) => item.u);
  const question = quiz.unitQuestion(card, variable);

  assert.equal(question.kind, "unit");
  assert.equal(question.promptTex, variable.s);
  assert.equal(question.choices.length, 4);
  assert.equal(question.choices.filter((choice) => choice.ok).length, 1);
  assert.equal(question.choices.find((choice) => choice.ok).text, variable.u);
});

test("empty sections and insufficient distractors do not create broken questions", () => {
  const sparse = createQuizContent(
    [{ s: "only", t: "one", f: "x = 1", vars: [{ s: "x", n: "x", u: "m" }] }],
    [{ id: "only", title: "Only" }],
    () => 0.5
  );
  const card = { s: "only", t: "one", f: "x = 1", vars: [{ s: "x", n: "x", u: "m" }] };

  assert.equal(sparse.formulaQuestion(card), null);
  assert.equal(sparse.unitQuestion(card, card.vars[0]), null);
  assert.deepEqual(sparse.buildDeck("missing"), []);
});
