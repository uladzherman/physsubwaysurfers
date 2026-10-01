/*
 * Сборка вопросов для раннера из данных тренажёра по физике (window.CARDS).
 * Два типа:
 *   formula — «какая формула соответствует величине?» (LaTeX-варианты);
 *   unit    — «в каких единицах СИ?» (текстовые варианты).
 * Одна «дорожка» вопроса — это 1 верный вариант + 3 неверных.
 */
(function (global) {
  "use strict";

  var CARDS = global.CARDS || [];
  var SECTIONS = global.SECTIONS || [];

  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Все уникальные единицы СИ из карточек.
  var ALL_UNITS = [];
  CARDS.forEach(function (c) {
    (c.vars || []).forEach(function (v) {
      if (v.u && ALL_UNITS.indexOf(v.u) === -1) ALL_UNITS.push(v.u);
    });
  });

  // Убираем LaTeX-разметку из текстовых подписей ($...$).
  function cleanText(s) { return String(s || "").replace(/\$/g, ""); }

  function pickWrong(correct, pool, n) {
    var others = shuffle(pool.filter(function (x) { return x !== correct; }));
    var out = others.slice(0, n);
    var i = 0;
    while (out.length < n && i < ALL_UNITS.length) {
      if (ALL_UNITS[i] !== correct && out.indexOf(ALL_UNITS[i]) === -1) out.push(ALL_UNITS[i]);
      i++;
    }
    return out;
  }

  function formulaQuestion(card) {
    var same = CARDS.filter(function (c) { return c.s === card.s && c.f !== card.f; });
    var pool = same.map(function (c) { return c.f; });
    var wrong = pickWrong(card.f, pool, 3);
    if (wrong.length < 3) return null;
    return {
      kind: "formula",
      section: card.s,
      cardId: card.s + "::" + card.t,
      promptText: "Какая формула соответствует величине:",
      promptTitle: cleanText(card.t),
      choices: shuffle([{ ok: true, tex: card.f }].concat(
        wrong.map(function (w) { return { ok: false, tex: w }; })
      ))
    };
  }

  function unitQuestion(card, v) {
    var wrong = pickWrong(v.u, ALL_UNITS, 3);
    if (wrong.length < 3) return null;
    return {
      kind: "unit",
      section: card.s,
      cardId: card.s + "::" + card.t,
      promptText: "В каких единицах СИ измеряется:",
      promptTex: v.s,
      promptTitle: cleanText(v.n),
      choices: shuffle([{ ok: true, text: v.u }].concat(
        wrong.map(function (w) { return { ok: false, text: w }; })
      ))
    };
  }

  // Колода вопросов для раздела: по одной формуле на карточку + единичные вопросы.
  function buildDeck(sectionId) {
    var cards = CARDS.filter(function (c) { return c.s === sectionId; });
    var deck = [];
    cards.forEach(function (card) {
      var q = formulaQuestion(card);
      if (q) deck.push(q);
      // Иногда, вместо формулы, спросим про единицы величины из этой карточки.
      var vars = card.vars || [];
      var withUnit = vars.filter(function (v) { return v.u; });
      if (withUnit.length && Math.random() < 0.35) {
        var v = withUnit[Math.floor(Math.random() * withUnit.length)];
        var uq = unitQuestion(card, v);
        if (uq) deck.push(uq);
      }
    });
    return shuffle(deck);
  }

  global.QuizContent = {
    buildDeck: buildDeck,
    formulaQuestion: formulaQuestion,
    unitQuestion: unitQuestion,
    allUnits: ALL_UNITS,
    sectionOrder: SECTIONS.map(function (s) { return s.id; }),
    sectionTitle: SECTIONS.reduce(function (m, s) { m[s.id] = s.title; return m; }, {})
  };
})(window);
