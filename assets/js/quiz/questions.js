import { shuffle } from "../core/random.js";

export function createQuizContent(cards, sections, random = Math.random) {
  const allUnits = [];
  cards.forEach((card) => {
    (card.vars || []).forEach((variable) => {
      if (variable.u && !allUnits.includes(variable.u)) allUnits.push(variable.u);
    });
  });

  function pickWrong(correct, pool, count) {
    const wrong = shuffle(pool.filter((value) => value !== correct), random).slice(0, count);
    let index = 0;
    while (wrong.length < count && index < allUnits.length) {
      const unit = allUnits[index++];
      if (unit !== correct && !wrong.includes(unit)) wrong.push(unit);
    }
    return wrong;
  }

  function formulaQuestion(card) {
    const formulas = cards
      .filter((candidate) => candidate.s === card.s && candidate.f !== card.f)
      .map((candidate) => candidate.f);
    const wrong = pickWrong(card.f, formulas, 3);
    if (wrong.length < 3) return null;

    return {
      kind: "formula",
      section: card.s,
      cardId: card.s + "::" + card.t,
      promptText: "Какая формула соответствует величине:",
      promptTitle: cleanText(card.t),
      choices: shuffle([{ ok: true, tex: card.f }].concat(
        wrong.map((formula) => ({ ok: false, tex: formula }))
      ), random)
    };
  }

  function unitQuestion(card, variable) {
    const wrong = pickWrong(variable.u, allUnits, 3);
    if (wrong.length < 3) return null;

    return {
      kind: "unit",
      section: card.s,
      cardId: card.s + "::" + card.t,
      promptText: "В каких единицах СИ измеряется:",
      promptTex: variable.s,
      promptTitle: cleanText(variable.n),
      choices: shuffle([{ ok: true, text: variable.u }].concat(
        wrong.map((unit) => ({ ok: false, text: unit }))
      ), random)
    };
  }

  function buildDeck(sectionId) {
    const deck = [];
    cards.filter((card) => card.s === sectionId).forEach((card) => {
      const formula = formulaQuestion(card);
      if (formula) deck.push(formula);

      const variables = (card.vars || []).filter((variable) => variable.u);
      if (variables.length && random() < 0.35) {
        const variable = variables[Math.floor(random() * variables.length)];
        const question = unitQuestion(card, variable);
        if (question) deck.push(question);
      }
    });
    return shuffle(deck, random);
  }

  return {
    buildDeck,
    formulaQuestion,
    unitQuestion,
    allUnits,
    sectionOrder: sections.map((section) => section.id),
    sectionTitle: sections.reduce((titles, section) => {
      titles[section.id] = section.title;
      return titles;
    }, {})
  };
}

function cleanText(value) {
  return String(value || "").replace(/\$/g, "");
}
