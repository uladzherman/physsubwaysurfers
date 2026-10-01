import { save } from "../core/storage.js";
import { SETTINGS_KEYS, SPEED_PRESETS } from "../core/settings.js";

export function mountSettingsMenu({ settings, sectionOrder, sectionTitle, cards, speedLabels }) {
  const sectionChips = document.getElementById("sectionChips");
  const speedChips = document.getElementById("speedChips");
  const menuHint = document.getElementById("menuHint");

  function updateHint() {
    const cardCount = cards.filter((card) => settings.sections.includes(card.s)).length;
    menuHint.textContent = "Разделов: " + settings.sections.length + " · карточек: " + cardCount +
      " · скорость: " + (speedLabels[settings.difficulty] || settings.difficulty);
  }

  function renderSectionChips() {
    sectionChips.replaceChildren();
    sectionOrder.forEach((id) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (settings.sections.includes(id) ? " is-active" : "");
      button.textContent = sectionTitle[id] || id;
      button.addEventListener("click", () => {
        const index = settings.sections.indexOf(id);
        if (index === -1) settings.sections.push(id);
        else if (settings.sections.length > 1) settings.sections.splice(index, 1);
        save(SETTINGS_KEYS.sections, settings.sections);
        renderSectionChips();
        updateHint();
      });
      sectionChips.appendChild(button);
    });
  }

  function refreshSpeedChips() {
    speedChips.querySelectorAll(".chip").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-speed") === settings.difficulty);
    });
  }

  speedChips.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      const speed = button.getAttribute("data-speed");
      if (!SPEED_PRESETS[speed]) return;
      settings.difficulty = speed;
      save(SETTINGS_KEYS.speed, speed);
      refreshSpeedChips();
      updateHint();
    });
  });

  renderSectionChips();
  refreshSpeedChips();
  updateHint();
}
