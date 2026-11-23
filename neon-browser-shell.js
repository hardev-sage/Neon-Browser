// Version 3 - neon-browser-shell.js
const searchProviderUrls = {
  "duckduckgo": "https://duckduckgo.com/?q=",
  "duckduckgo-lite": "https://lite.duckduckgo.com/lite/?q=",
  "brave-search": "https://search.brave.com/search?q=",
};
const bangSearchUrl = "https://duckduckgo.com/?q=";
const bangPattern = /(^|\s)![A-Za-z0-9]+(\s|$)/;
const webAddressPattern = /^[^\s/]+\.[^\s/]+(\/\S*)?$/;
const fullUrlPattern = /^https?:\/\/\S+$/i;

const paneSizeMinimumPercent = 20;
const paneSizeMaximumPercent = 80;
const paneSizeKeyboardStepPercent = 5;

const pageArea = document.querySelector(".page-area");
const firstPagePane = document.getElementById("page-pane-1");
const tabList = document.querySelector(".tab-list");
const addressForm = document.querySelector(".address-form");
const addressInput = document.querySelector(".address-input");
const searchProviderSelect = document.querySelector(".search-provider-select");
const compactModeButton = document.querySelector('[data-action="toggle-compact-mode"]');
const splitViewButton = document.querySelector('[data-action="toggle-split-view"]');

let nextTabNumber = 2;

function emit(eventName, detail = {}) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function getTabButtons() {
  return [...tabList.querySelectorAll('[role="tab"]')];
}

function getSelectedTabButton() {
  return tabList.querySelector('[role="tab"][aria-selected="true"]');
}

function resolveAddress(text) {
  if (bangPattern.test(text)) {
    return bangSearchUrl + encodeURIComponent(text);
  }
  if (fullUrlPattern.test(text)) {
    return text;
  }
  if (webAddressPattern.test(text)) {
    return "https://" + text;
  }
  return searchProviderUrls[searchProviderSelect.value] + encodeURIComponent(text);
}

function setTabTitle(tabButton, title) {
  tabButton.querySelector("[data-tab-title]").textContent = title;
  tabButton
    .closest(".tab-item")
    .querySelector(".tab-close-button")
    .setAttribute("aria-label", `Close tab ${title}`);
}

function selectTab(selectedTabButton) {
  for (const tabButton of getTabButtons()) {
    const isSelected = tabButton === selectedTabButton;
    tabButton.setAttribute("aria-selected", String(isSelected));
    tabButton.tabIndex = isSelected ? 0 : -1;
  }
  firstPagePane.setAttribute("aria-labelledby", selectedTabButton.id);
  emit("neon:tab-selected", { tabId: selectedTabButton.id });
}

function addTab() {
  const tabNumber = nextTabNumber++;
  const tabItem = document.createElement("li");
  tabItem.className = "tab-item";
  tabItem.setAttribute("role", "presentation");
  tabItem.innerHTML = `
    <button class="tab-button" type="button" role="tab" id="tab-${tabNumber}" aria-selected="false" aria-controls="page-pane-1">
      <span data-tab-title>New tab</span>
    </button>
    <button class="tab-close-button" type="button" data-action="close-tab" aria-label="Close tab New tab">
      <svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-close"/></svg>
    </button>`;
  tabList.append(tabItem);
  const tabButton = tabItem.querySelector('[role="tab"]');
  selectTab(tabButton);
  tabButton.scrollIntoView({ inline: "nearest" });
  emit("neon:tab-created", { tabId: tabButton.id });
}

function closeTab(tabItem) {
  const tabButton = tabItem.querySelector('[role="tab"]');
  const wasSelected = tabButton.getAttribute("aria-selected") === "true";
  const neighborItem = tabItem.nextElementSibling ?? tabItem.previousElementSibling;
  tabItem.remove();
  emit("neon:tab-closed", { tabId: tabButton.id });
  if (!neighborItem) {
    addTab();
  } else if (wasSelected) {
    selectTab(neighborItem.querySelector('[role="tab"]'));
  }
}

function closeSelectedTab() {
  closeTab(getSelectedTabButton().closest(".tab-item"));
}

function focusAddressInput() {
  addressInput.focus();
  addressInput.select();
}

function toggleCompactMode() {
  const isCompact = document.body.dataset.density !== "compact";
  document.body.dataset.density = isCompact ? "compact" : "comfortable";
  compactModeButton.setAttribute("aria-pressed", String(isCompact));
  emit("neon:density-changed", { density: document.body.dataset.density });
}

function setFirstPaneSize(resizer, percent) {
  const clampedPercent = Math.min(paneSizeMaximumPercent, Math.max(paneSizeMinimumPercent, percent));
  pageArea.style.setProperty("--pane-first-size", `${clampedPercent}%`);
  resizer.setAttribute("aria-valuenow", String(Math.round(clampedPercent)));
}

function createPaneResizer() {
  const resizer = document.createElement("div");
  resizer.className = "pane-resizer";
  resizer.id = "pane-resizer";
  resizer.tabIndex = 0;
  resizer.setAttribute("role", "separator");
  resizer.setAttribute("aria-orientation", "vertical");
  resizer.setAttribute("aria-label", "Resize panes");
  resizer.setAttribute("aria-controls", "page-pane-1");
  resizer.setAttribute("aria-valuemin", String(paneSizeMinimumPercent));
  resizer.setAttribute("aria-valuemax", String(paneSizeMaximumPercent));
  resizer.setAttribute("aria-valuenow", "50");
  return resizer;
}

function createSecondPagePane() {
  const secondPagePane = document.createElement("section");
  secondPagePane.className = "page-pane";
  secondPagePane.id = "page-pane-2";
  secondPagePane.setAttribute("aria-label", "Second page");
  return secondPagePane;
}

function toggleSplitView() {
  const isSplit = document.body.dataset.paneLayout !== "split";
  document.body.dataset.paneLayout = isSplit ? "split" : "single";
  if (isSplit) {
    pageArea.append(createPaneResizer(), createSecondPagePane());
  } else {
    document.getElementById("pane-resizer").remove();
    document.getElementById("page-pane-2").remove();
    pageArea.style.removeProperty("--pane-first-size");
  }
  splitViewButton.setAttribute("aria-pressed", String(isSplit));
  emit("neon:pane-layout-changed", { layout: document.body.dataset.paneLayout });
}

function navigateTo(url) {
  addressInput.value = url;
  setTabTitle(getSelectedTabButton(), new URL(url).hostname);
  emit("neon:navigate", { url });
}

const buttonActions = {
  "new-tab": addTab,
  "close-tab": (closeButton) => closeTab(closeButton.closest(".tab-item")),
  "toggle-compact-mode": toggleCompactMode,
  "toggle-split-view": toggleSplitView,
};

const shortcutActions = {
  l: focusAddressInput,
  t: addTab,
  w: closeSelectedTab,
};

document.addEventListener("click", (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) {
    return;
  }
  const action = actionElement.dataset.action;
  if (action in buttonActions) {
    buttonActions[action](actionElement);
  } else {
    emit("neon:command", { action });
  }
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!event.ctrlKey || !(key in shortcutActions)) {
    return;
  }
  event.preventDefault();
  shortcutActions[key]();
});

pageArea.addEventListener("pointerdown", (event) => {
  const resizer = event.target.closest(".pane-resizer");
  if (!resizer) {
    return;
  }
  resizer.setPointerCapture(event.pointerId);
  resizer.dataset.dragging = "";
});

pageArea.addEventListener("pointermove", (event) => {
  const resizer = event.target.closest(".pane-resizer");
  if (!resizer || !("dragging" in resizer.dataset)) {
    return;
  }
  const areaBounds = pageArea.getBoundingClientRect();
  setFirstPaneSize(resizer, ((event.clientX - areaBounds.left) / areaBounds.width) * 100);
});

pageArea.addEventListener("pointerup", (event) => {
  const resizer = event.target.closest(".pane-resizer");
  if (resizer) {
    delete resizer.dataset.dragging;
  }
});

pageArea.addEventListener("keydown", (event) => {
  const resizer = event.target.closest(".pane-resizer");
  if (!resizer || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const step = event.key === "ArrowRight" ? paneSizeKeyboardStepPercent : -paneSizeKeyboardStepPercent;
  setFirstPaneSize(resizer, Number(resizer.getAttribute("aria-valuenow")) + step);
});

tabList.addEventListener("click", (event) => {
  const tabButton = event.target.closest('[role="tab"]');
  if (tabButton) {
    selectTab(tabButton);
  }
});

tabList.addEventListener("keydown", (event) => {
  const currentTabButton = event.target.closest('[role="tab"]');
  if (!currentTabButton || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
    return;
  }
  const tabButtons = getTabButtons();
  const step = event.key === "ArrowRight" ? 1 : -1;
  const nextIndex = (tabButtons.indexOf(currentTabButton) + step + tabButtons.length) % tabButtons.length;
  tabButtons[nextIndex].focus();
  selectTab(tabButtons[nextIndex]);
});

addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = addressInput.value.trim();
  if (text) {
    navigateTo(resolveAddress(text));
  }
});

selectTab(getTabButtons()[0]);
