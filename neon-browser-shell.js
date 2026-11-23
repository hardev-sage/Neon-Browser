// Version 4 - neon-browser-shell.js
const searchProviderUrls = {
  "duckduckgo": "https://duckduckgo.com/?q=",
  "duckduckgo-lite": "https://lite.duckduckgo.com/lite/?q=",
  "brave-search": "https://search.brave.com/search?q=",
};
const bangSearchUrl = "https://duckduckgo.com/?q=";
const bangPattern = /(^|\s)![A-Za-z0-9]+(\s|$)/;
const webAddressPattern = /^[^\s/]+\.[^\s/]+(\/\S*)?$/;
const fullUrlPattern = /^https?:\/\/\S+$/i;

const newTabTitle = "New tab";
const paneSizeMinimumPercent = 20;
const paneSizeMaximumPercent = 80;
const paneSizeKeyboardStepPercent = 5;

const pageArea = document.querySelector(".page-area");
const firstPagePane = document.getElementById("page-pane-1");
const tabList = document.querySelector(".tab-list");
const workspaceSwitcherButton = document.querySelector(".workspace-switcher");
const workspaceMenu = document.getElementById("workspace-menu");
const tabItemTemplate = document.getElementById("tab-item-template");
const workspaceMenuItemTemplate = document.getElementById("workspace-menu-item-template");
const addressForm = document.querySelector(".address-form");
const addressInput = document.querySelector(".address-input");
const searchProviderSelect = document.querySelector(".search-provider-select");
const compactModeButton = document.querySelector('[data-action="toggle-compact-mode"]');
const splitViewButton = document.querySelector('[data-action="toggle-split-view"]');

let nextTabNumber = 1;

function createTab() {
  return { id: `tab-${nextTabNumber++}`, title: newTabTitle, url: "" };
}

function createWorkspace(id, name) {
  const firstTab = createTab();
  return { id, name, tabs: [firstTab], selectedTabId: firstTab.id };
}

const workspaces = [
  createWorkspace("personal", "Personal"),
  createWorkspace("development", "Development"),
  createWorkspace("study", "Study"),
];
let activeWorkspace = workspaces[0];

function emit(eventName, detail = {}) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function getSelectedTab() {
  return activeWorkspace.tabs.find((tab) => tab.id === activeWorkspace.selectedTabId);
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

function createTabItem(tab) {
  const isSelected = tab.id === activeWorkspace.selectedTabId;
  const tabItem = tabItemTemplate.content.firstElementChild.cloneNode(true);
  const tabButton = tabItem.querySelector('[role="tab"]');
  tabItem.dataset.tabId = tab.id;
  tabButton.id = tab.id;
  tabButton.setAttribute("aria-selected", String(isSelected));
  tabButton.tabIndex = isSelected ? 0 : -1;
  tabButton.querySelector("[data-tab-title]").textContent = tab.title;
  tabItem.querySelector(".tab-close-button").setAttribute("aria-label", `Close tab ${tab.title}`);
  return tabItem;
}

function renderTabs() {
  tabList.replaceChildren(...activeWorkspace.tabs.map(createTabItem));
  const selectedTabButton = document.getElementById(activeWorkspace.selectedTabId);
  firstPagePane.setAttribute("aria-labelledby", selectedTabButton.id);
  selectedTabButton.scrollIntoView({ inline: "nearest" });
  addressInput.value = getSelectedTab().url;
}

function selectTab(tabId) {
  activeWorkspace.selectedTabId = tabId;
  renderTabs();
  emit("neon:tab-selected", { tabId });
}

function addTab() {
  const tab = createTab();
  activeWorkspace.tabs.push(tab);
  emit("neon:tab-created", { tabId: tab.id });
  selectTab(tab.id);
}

function closeTab(tabId) {
  const tabs = activeWorkspace.tabs;
  const closedIndex = tabs.findIndex((tab) => tab.id === tabId);
  tabs.splice(closedIndex, 1);
  emit("neon:tab-closed", { tabId });
  if (tabs.length === 0) {
    addTab();
  } else if (activeWorkspace.selectedTabId === tabId) {
    selectTab(tabs[Math.min(closedIndex, tabs.length - 1)].id);
  } else {
    renderTabs();
  }
}

function closeSelectedTab() {
  closeTab(activeWorkspace.selectedTabId);
}

function navigateTo(url) {
  const tab = getSelectedTab();
  tab.url = url;
  tab.title = new URL(url).hostname;
  renderTabs();
  emit("neon:navigate", { url });
}

function focusAddressInput() {
  addressInput.focus();
  addressInput.select();
}

function renderWorkspaceMenu() {
  workspaceMenu.replaceChildren(
    ...workspaces.map((workspace) => {
      const menuItem = workspaceMenuItemTemplate.content.firstElementChild.cloneNode(true);
      const menuItemButton = menuItem.querySelector("button");
      menuItemButton.dataset.workspaceId = workspace.id;
      menuItemButton.textContent = workspace.name;
      menuItemButton.tabIndex = -1;
      menuItemButton.setAttribute("aria-checked", String(workspace === activeWorkspace));
      return menuItem;
    }),
  );
}

function renderWorkspaceSwitcher() {
  workspaceSwitcherButton.querySelector("[data-workspace-name]").textContent = activeWorkspace.name;
  workspaceSwitcherButton.setAttribute("aria-label", `${activeWorkspace.name}, switch workspace`);
}

function openWorkspaceMenu() {
  workspaceMenu.hidden = false;
  workspaceSwitcherButton.setAttribute("aria-expanded", "true");
  workspaceMenu.querySelector('[aria-checked="true"]').focus();
}

function closeWorkspaceMenu() {
  workspaceMenu.hidden = true;
  workspaceSwitcherButton.setAttribute("aria-expanded", "false");
}

function toggleWorkspaceMenu() {
  if (workspaceMenu.hidden) {
    openWorkspaceMenu();
  } else {
    closeWorkspaceMenu();
  }
}

function switchWorkspace(workspaceId) {
  activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  renderWorkspaceMenu();
  renderWorkspaceSwitcher();
  renderTabs();
  closeWorkspaceMenu();
  emit("neon:workspace-changed", { workspaceId });
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

const buttonActions = {
  "new-tab": addTab,
  "close-tab": (closeButton) => closeTab(closeButton.closest(".tab-item").dataset.tabId),
  "toggle-workspace-menu": toggleWorkspaceMenu,
  "toggle-compact-mode": toggleCompactMode,
  "toggle-split-view": toggleSplitView,
};

const shortcutActions = {
  l: focusAddressInput,
  t: addTab,
  w: closeSelectedTab,
};

document.addEventListener("click", (event) => {
  if (!workspaceMenu.hidden && !event.target.closest(".workspace-picker")) {
    closeWorkspaceMenu();
  }
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

workspaceMenu.addEventListener("click", (event) => {
  const menuItemButton = event.target.closest("[data-workspace-id]");
  if (menuItemButton) {
    switchWorkspace(menuItemButton.dataset.workspaceId);
    workspaceSwitcherButton.focus();
  }
});

workspaceMenu.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeWorkspaceMenu();
    workspaceSwitcherButton.focus();
    return;
  }
  if (event.key === "Tab") {
    closeWorkspaceMenu();
    return;
  }
  if (!["ArrowUp", "ArrowDown"].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const menuItemButtons = [...workspaceMenu.querySelectorAll("button")];
  const step = event.key === "ArrowDown" ? 1 : -1;
  const currentIndex = menuItemButtons.indexOf(document.activeElement);
  menuItemButtons[(currentIndex + step + menuItemButtons.length) % menuItemButtons.length].focus();
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
    selectTab(tabButton.id);
  }
});

tabList.addEventListener("keydown", (event) => {
  const currentTabButton = event.target.closest('[role="tab"]');
  if (!currentTabButton || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
    return;
  }
  const tabs = activeWorkspace.tabs;
  const step = event.key === "ArrowRight" ? 1 : -1;
  const currentIndex = tabs.findIndex((tab) => tab.id === currentTabButton.id);
  const nextTab = tabs[(currentIndex + step + tabs.length) % tabs.length];
  selectTab(nextTab.id);
  document.getElementById(nextTab.id).focus();
});

addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = addressInput.value.trim();
  if (text) {
    navigateTo(resolveAddress(text));
  }
});

renderWorkspaceMenu();
renderWorkspaceSwitcher();
renderTabs();
