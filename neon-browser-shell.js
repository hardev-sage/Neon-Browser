const searchProviderUrls = {
  "duckduckgo": "https://duckduckgo.com/?q=",
  "duckduckgo-lite": "https://lite.duckduckgo.com/lite/?q=",
  "brave-search": "https://search.brave.com/search?q=",
};
const bangSearchUrl = "https://duckduckgo.com/?q=";
const bangPattern = /(^|\s)![A-Za-z0-9]+(\s|$)/;
const webAddressPattern = /^[^\s/]+\.[^\s/]+(\/\S*)?$/;
const fullUrlPattern = /^https?:\/\/\S+$/i;

const pageArea = document.querySelector(".page-area");
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

function selectTab(selectedTabButton) {
  for (const tabButton of getTabButtons()) {
    const isSelected = tabButton === selectedTabButton;
    tabButton.setAttribute("aria-selected", String(isSelected));
    tabButton.tabIndex = isSelected ? 0 : -1;
  }
  document.getElementById("page-pane-1").setAttribute("aria-labelledby", selectedTabButton.id);
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

function closeTab(closeButton) {
  const tabItem = closeButton.closest(".tab-item");
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

function toggleCompactMode() {
  const isCompact = document.body.dataset.density !== "compact";
  document.body.dataset.density = isCompact ? "compact" : "comfortable";
  compactModeButton.setAttribute("aria-pressed", String(isCompact));
  emit("neon:density-changed", { density: document.body.dataset.density });
}

function toggleSplitView() {
  const isSplit = document.body.dataset.paneLayout !== "split";
  document.body.dataset.paneLayout = isSplit ? "split" : "single";
  if (isSplit) {
    const secondPane = document.createElement("section");
    secondPane.className = "page-pane";
    secondPane.id = "page-pane-2";
    secondPane.setAttribute("aria-label", "Second page");
    pageArea.append(secondPane);
  } else {
    pageArea.querySelector("#page-pane-2").remove();
  }
  splitViewButton.setAttribute("aria-pressed", String(isSplit));
  emit("neon:pane-layout-changed", { layout: document.body.dataset.paneLayout });
}

const localActions = {
  "new-tab": addTab,
  "close-tab": closeTab,
  "toggle-compact-mode": toggleCompactMode,
  "toggle-split-view": toggleSplitView,
};

document.addEventListener("click", (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) {
    return;
  }
  const action = actionElement.dataset.action;
  if (action in localActions) {
    localActions[action](actionElement);
  } else {
    emit("neon:command", { action });
  }
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
    emit("neon:navigate", { url: resolveAddress(text) });
  }
});

selectTab(getTabButtons()[0]);
