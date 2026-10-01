import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const EXTENSION_NAME = "AnimaTagCompleter.Core";
const FAVORITES_STORAGE_KEY = "AnimaTagCompleter.Favorites";

const state = {
  activeElement: null,
  suggestions: [],
  selectedIndex: -1,
  wrapper: null,
  favoritesEl: null,
  resultsEl: null,
  favorites: [],
  abortController: null,
  requestId: 0,
  lastQuery: "",
  customCategories: new Set(),
  pagination: null,
};

async function loadCustomCategories() {
  try {
    const res = await api.fetchApi("/anima_tag_completer/sources");
    if (!res.ok) return;
    const tree = await res.json();
    if (!tree || typeof tree !== "object") return;

    const cats = tree.custom;
    if (Array.isArray(cats)) {
      state.customCategories = new Set(cats.map((c) => String(c).toLowerCase()));
    }
  } catch (err) {}
}

function getActiveSources() {
  const get = (id, fallback) => {
    try {
      const v = app.extensionManager?.setting?.get(id);
      return v === undefined || v === null || v === "" ? fallback : v;
    } catch {
      return fallback;
    }
  };

  const sources = ["custom"];
  const toggleable = ["Danbooru", "Gelbooru", "Safebooru", "ThetaCursed"];
  for (const src of toggleable) {
    if (get(`AnimaTagCompleter.Source.${src}`, true)) {
      sources.push(src.toLowerCase());
    }
  }
  return sources;
}

function getSettings() {
  const get = (id, fallback) => {
    try {
      const v = app.extensionManager?.setting?.get(id);
      return v === undefined || v === null || v === "" ? fallback : v;
    } catch {
      return fallback;
    }
  };

  return {
    enabled: get("AnimaTagCompleter.Enabled", true),
    favoritesDisplayMode: get("AnimaTagCompleter.FavoritesDisplayMode", "trigger"),
    tagDisplayMode: get("AnimaTagCompleter.TagDisplayMode", "all"),
    minChars: Number(get("AnimaTagCompleter.MinChars", 2)),
    maxSuggestions: Number(get("AnimaTagCompleter.MaxSuggestions", 30)),
    delimiter: get("AnimaTagCompleter.Delimiter", ","),
    artistPrefix: get("AnimaTagCompleter.ArtistPrefix", "@"),
    showDeprecated: get("AnimaTagCompleter.ShowDeprecated", false),
    scoreAbbreviation: get("AnimaTagCompleter.ScoreAbbreviation", true),
  };
}

const TRANSLATIONS = {
  en: {
    language: { name: "Interface language", tooltip: "Requires a page reload to take effect", options: { en: "English", ru: "Русский" } },
    enable: { name: "Enable extension", tooltip: "On/Off TagCompleter" },
    favMode: {
      name: "How to show favorite tags",
      tooltip: "Choose how favorite tags are shown: by typing '--fav', or automatically when you focus the text field",
      options: { trigger: "Type --fav", focus: "On input focus" },
    },
    showDeprecated: { name: "Show tags from the Deprecated category" },
    scoreAbbr: {
      name: "Enable score abbreviation (K/M/B)",
      tooltip: "On/Off Number Abbreviation\n\n1234 > 1.2K\n12345 > 12.3K\n9988888 > 9.9M",
    },
    minChars: {
      name: "Minimum characters to trigger search",
      tooltip: "Doesn't apply when filtering with --category — those show results immediately",
    },
    maxSuggestions: { name: "Maximum number of suggestions" },
    delimiter: {
      name: "Delimiter",
      tooltip: "A space is always inserted after the tag, the delimiter is inserted before this space",
      options: { comma: ", (comma)", period: ". (period)", none: "None" },
    },
    artistPrefix: { name: "Prefix before Artist category tags", tooltip: "@ is standard for Anima" },
    tagDisplayMode: {
      name: "Tag display mode",
      tooltip: "'All matches' lists every match, including duplicates from different sources. 'Highest score' collapses duplicates to a single entry with the best score.",
      options: { all: "All matches", highest: "Highest score" },
    },
    sources: {
      danbooru: { name: "Danbooru source", tooltip: "Enable/disable tag search from Danbooru" },
      gelbooru: { name: "Gelbooru source", tooltip: "Enable/disable tag search from Gelbooru" },
      safebooru: { name: "Safebooru source", tooltip: "Enable/disable tag search from Safebooru" },
      thetacursed: { name: "ThetaCursed source", tooltip: "Enable/disable tag search from ThetaCursed" },
    },
    openCustom: { name: "Custom tags folder", button: "Open Custom", tooltip: "Opens the ./tags/Custom folder" },
    showMore: "Show more",
  },
  ru: {
    language: { name: "Язык интерфейса", tooltip: "Для применения нужна перезагрузка страницы", options: { en: "English", ru: "Русский" } },
    enable: { name: "Включить расширение", tooltip: "Вкл/выкл TagCompleter" },
    favMode: {
      name: "Как показывать избранные теги",
      tooltip: "Выберите способ показа избранных тегов: по вводу '--fav' или автоматически при клике на текстовое поле",
      options: { trigger: "Ввод --fav", focus: "Клик на input" },
    },
    showDeprecated: { name: "Показывать теги из категории Deprecated" },
    scoreAbbr: {
      name: "Сокращать score (K/M/B)",
      tooltip: "Вкл/выкл сокращение чисел\n\n1234 > 1.2K\n12345 > 12.3K\n9988888 > 9.9M",
    },
    minChars: {
      name: "Минимум символов для запуска поиска",
      tooltip: "Не применяется при фильтре --category, такие результаты показываются сразу.",
    },
    maxSuggestions: { name: "Максимум найденных тегов" },
    delimiter: {
      name: "Разделитель",
      tooltip: "Пробел вставляется всегда, разделитель вставляется перед этим пробелом.",
      options: { comma: ", (запятая)", period: ". (точка)", none: "Нет" },
    },
    artistPrefix: { name: "Префикс перед тегами категории Artist", tooltip: "@ — стандарт для Anima." },
    tagDisplayMode: {
      name: "Режим отображения тегов",
      tooltip: "«Все совпадения» выводит каждый результат, включая дубликаты из разных источников. «Высший score» отображает только тег с максимальным score.",
      options: { all: "Все совпадения", highest: "Высший score" },
    },
    sources: {
      danbooru: { name: "Danbooru", tooltip: "Включить/отключить поиск тегов из Danbooru" },
      gelbooru: { name: "Gelbooru", tooltip: "Включить/отключить поиск тегов из Gelbooru" },
      safebooru: { name: "Safebooru", tooltip: "Включить/отключить поиск тегов из Safebooru" },
      thetacursed: { name: "ThetaCursed", tooltip: "Включить/отключить поиск тегов из ThetaCursed" },
    },
    openCustom: { name: "Папка Custom", button: "Открыть Custom", tooltip: "Открывает папку ./tags/Custom" },
    showMore: "Показать ещё",
  },
};

function getLanguage() {
  try {
    const v = app.extensionManager?.setting?.get("AnimaTagCompleter.Language");
    return v === "ru" ? "ru" : "en";
  } catch {
    return "en";
  }
}

const LANG = getLanguage();
const T = TRANSLATIONS[LANG] || TRANSLATIONS.en;

function isTextWidget(el) {
  if (!el) return false;
  if (el.tagName !== "TEXTAREA") return false;
  if (el.readOnly || el.disabled) return false;
  return true;
}

function getCurrentFragment(el) {
  const value = el.value ?? "";
  const caret = el.selectionStart ?? value.length;
  const before = value.slice(0, caret);
  const after = value.slice(caret);

  const rawMatch = /(?:^|(?<!\\)[,\n\(\)\[\]\{\}:])([^\n,\(\)\[\]\{\}:]*)$/.exec(before);
  const rawStart = rawMatch ? caret - rawMatch[1].length : caret;

  const leadingWsMatch = /^[ \t]*/.exec(value.slice(rawStart, caret));
  const fragmentStart = rawStart + (leadingWsMatch ? leadingWsMatch[0].length : 0);

  const charBeforeCaret = before.slice(-1);
  const isMidWord = charBeforeCaret !== "" && !/[\s,\n\(\)\[\]\{\}:]/.test(charBeforeCaret);

  const endMatch = isMidWord ? /^(?:(?<!\\)[^\s,\n\(\)\[\]\{\}:])*/.exec(after) : null;
  const fullEnd = endMatch ? caret + endMatch[0].length : caret;

  return {
    fragment: value.slice(fragmentStart, caret),
    fullStart: fragmentStart,
    fullEnd,
  };
}

function parseCategoryFilter(fragment) {
  const withQuery = /^--(\S+)\s+(.*)$/.exec(fragment);
  if (withQuery) {
    return { category: withQuery[1], query: withQuery[2].trim(), pending: false };
  }
  const bare = /^--(\S*)$/.exec(fragment);
  if (bare) {
    return { category: bare[1] || null, query: "", pending: true };
  }
  return { category: null, query: fragment.trim(), pending: false };
}

function parseFavoritesTrigger(fragment) {
  const match = /^--fav(?:\s+(.*))?$/i.exec(fragment.trim());
  if (!match) return null;
  return { filterText: (match[1] || "").trim().toLowerCase() };
}

function spaceifyTagName(name) {
  return String(name ?? "").replace(/_/g, " ");
}

function escapeParens(s) {
  return s.replace(/([()])/g, "\\$1");
}

function normalizeTagText(name) {
  return escapeParens(spaceifyTagName(name));
}

function tagGroupKey(name) {
  return String(name ?? "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function buildHighlightParts(name, query) {
  const spaced = spaceifyTagName(name);
  if (!query) return [{ text: spaced, highlight: false }];

  const stripped = [];
  const map = [];
  for (let i = 0; i < spaced.length; i++) {
    const ch = spaced[i];
    if (ch === "(" || ch === ")") continue;
    stripped.push(ch);
    map.push(i);
  }
  const strippedStr = stripped.join("");

  const idx = strippedStr.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return [{ text: spaced, highlight: false }];

  const startOrig = map[idx];
  const endOrig = idx + query.length - 1 < map.length ? map[idx + query.length - 1] + 1 : spaced.length;

  const pre = spaced.slice(0, startOrig);
  const match = spaced.slice(startOrig, endOrig);
  const post = spaced.slice(endOrig);

  return [
    { text: pre, highlight: false },
    { text: match, highlight: true },
    { text: post, highlight: false },
  ].filter((part) => part.text.length > 0);
}

function matchPermutedWords(queryWords, nameWords) {
  const used = new Array(nameWords.length).fill(false);
  const assignment = new Array(queryWords.length).fill(-1);

  function backtrack(i) {
    if (i === queryWords.length) return true;
    for (let j = 0; j < nameWords.length; j++) {
      if (used[j]) continue;
      if (nameWords[j].startsWith(queryWords[i])) {
        used[j] = true;
        assignment[i] = j;
        if (backtrack(i + 1)) return true;
        used[j] = false;
        assignment[i] = -1;
      }
    }
    return false;
  }

  return backtrack(0) ? assignment : null;
}

function buildFuzzyHighlightParts(name, query) {
  const spaced = spaceifyTagName(name);
  const queryWords = query.trim().split(/\s+/).filter(Boolean);
  if (queryWords.length < 2) return buildHighlightParts(name, query);

  const pieces = spaced.split(/(\s+)/);
  const wordPieceIndices = [];
  pieces.forEach((piece, idx) => {
    if (piece && !/^\s+$/.test(piece)) wordPieceIndices.push(idx);
  });

  const nameWordsNorm = wordPieceIndices.map((idx) => pieces[idx].replace(/[()]/g, "").toLowerCase());
  const queryWordsNorm = queryWords.map((w) => w.toLowerCase());

  const assignment = matchPermutedWords(queryWordsNorm, nameWordsNorm);
  if (!assignment) return buildHighlightParts(name, query);

  const highlightByPieceIdx = new Map();
  assignment.forEach((wordPos, qIdx) => {
    if (wordPos === -1) return;
    highlightByPieceIdx.set(wordPieceIndices[wordPos], queryWords[qIdx]);
  });

  const parts = [];
  pieces.forEach((piece, idx) => {
    if (!piece) return;
    if (highlightByPieceIdx.has(idx)) {
      parts.push(...buildHighlightParts(piece, highlightByPieceIdx.get(idx)));
    } else {
      parts.push({ text: piece, highlight: false });
    }
  });

  return parts.filter((part) => part.text.length > 0);
}

const MIRROR_STYLE_PROPS = ["boxSizing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "wordSpacing", "textTransform", "textIndent", "lineHeight", "tabSize", "direction"];

function createMirrorDiv(el) {
  const div = document.createElement("div");
  const style = getComputedStyle(el);

  MIRROR_STYLE_PROPS.forEach((prop) => {
    div.style[prop] = style[prop];
  });

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.width = `${el.clientWidth}px`;
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.overflowWrap = "break-word";

  document.body.appendChild(div);
  return div;
}

function getCaretCoordinates(el, index) {
  const div = createMirrorDiv(el);
  try {
    const value = el.value ?? "";
    div.textContent = value.slice(0, index);

    const span = document.createElement("span");
    span.textContent = value.slice(index, index + 1) || ".";
    div.appendChild(span);

    return {
      left: span.offsetLeft,
      top: span.offsetTop,
      height: span.offsetHeight || parseFloat(getComputedStyle(el).lineHeight) || 16,
    };
  } finally {
    document.body.removeChild(div);
  }
}

function getScaleFactor(el, rect) {
  const scaleX = el.offsetWidth ? rect.width / el.offsetWidth : 1;
  const scaleY = el.offsetHeight ? rect.height / el.offsetHeight : 1;
  return { scaleX, scaleY };
}

function clampToViewport(left, top, width, height, margin = 6) {
  const viewportLeft = window.scrollX + margin;
  const viewportRight = window.scrollX + window.innerWidth - margin;
  const viewportTop = window.scrollY + margin;
  const viewportBottom = window.scrollY + window.innerHeight - margin;

  let clampedLeft = left;
  if (clampedLeft < viewportLeft) clampedLeft = viewportLeft;
  if (clampedLeft + width > viewportRight) clampedLeft = Math.max(viewportLeft, viewportRight - width);

  let clampedTop = top;
  if (clampedTop + height > viewportBottom) clampedTop = Math.max(viewportTop, viewportBottom - height);
  if (clampedTop < viewportTop) clampedTop = viewportTop;

  return { left: clampedLeft, top: clampedTop };
}

function positionPopup(el, index) {
  const wrapper = ensurePopup();
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const borderTop = parseFloat(style.borderTopWidth) || 0;

  let coords;
  try {
    coords = getCaretCoordinates(el, index);
  } catch (err) {
    coords = { left: 0, top: 0, height: parseFloat(style.lineHeight) || 16 };
  }

  const { scaleY } = getScaleFactor(el, rect);

  const nominalTop = borderTop + coords.top + coords.height - el.scrollTop;
  const anchorTop = rect.top + window.scrollY + nominalTop * scaleY;

  const anchorLeft = rect.left + window.scrollX + rect.width / 2;

  const wrapperWidth = wrapper.offsetWidth || 200;
  const wrapperHeight = wrapper.offsetHeight || 0;

  const desiredLeft = anchorLeft - wrapperWidth / 2;
  const desiredTop = anchorTop;

  const { left, top } = clampToViewport(desiredLeft, desiredTop, wrapperWidth, wrapperHeight);

  wrapper.style.left = `${left}px`;
  wrapper.style.top = `${top}px`;
}

const SCORE_TIERS = [
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
];

function truncateToSigFigs(value, sigFigs) {
  if (value <= 0) return 0;
  const magnitude = Math.floor(Math.log10(value));
  const factor = Math.pow(10, sigFigs - 1 - magnitude);
  return Math.floor(value * factor) / factor;
}

function formatScore(rawScore, enabled) {
  const value = Math.max(0, Number(rawScore) || 0);
  const raw = Math.trunc(value).toString();

  if (!enabled || value < 1000) return raw;

  const tier = SCORE_TIERS.find((t) => value >= t.value);
  if (!tier) return raw;

  const scaled = truncateToSigFigs(value / tier.value, 2);
  const magnitude = scaled === 0 ? 0 : Math.floor(Math.log10(scaled));
  const decimals = Math.max(0, 1 - magnitude);
  const formatted = scaled.toFixed(decimals).replace(/\.0+$/, "");

  return `${formatted}${tier.suffix}`;
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state.favorites));
  } catch (err) {}
}

function favoriteKey(tag) {
  return `${tag?.source ?? ""}::${tag?.category ?? ""}::${tagGroupKey(tag?.name ?? "")}`.toLowerCase();
}

function findFavoriteIndex(tag) {
  const key = favoriteKey(tag);
  return state.favorites.findIndex((f) => favoriteKey(f) === key);
}

function isFavorite(tag) {
  return findFavoriteIndex(tag) !== -1;
}

function toggleFavorite(tag) {
  const idx = findFavoriteIndex(tag);
  if (idx === -1) {
    state.favorites.push({
      name: tag.name,
      category: tag.category,
      source: tag.source,
      score: tag.score,
    });
  } else {
    state.favorites.splice(idx, 1);
  }
  saveFavorites();
}

function isFavoriteGroup(tags) {
  return tags.length > 0 && tags.every(isFavorite);
}

function toggleFavoriteGroup(tags) {
  if (isFavoriteGroup(tags)) {
    tags.forEach((tag) => {
      const idx = findFavoriteIndex(tag);
      if (idx !== -1) state.favorites.splice(idx, 1);
    });
  } else {
    tags.forEach((tag) => {
      if (!isFavorite(tag)) {
        state.favorites.push({
          name: tag.name,
          category: tag.category,
          source: tag.source,
          score: tag.score,
        });
      }
    });
  }
  saveFavorites();
}

function getSortedFavorites() {
  return [...state.favorites].sort((a, b) => {
    const aArtist = String(a.category ?? "").toLowerCase() === "artist" ? 0 : 1;
    const bArtist = String(b.category ?? "").toLowerCase() === "artist" ? 0 : 1;
    return aArtist - bArtist;
  });
}

state.favorites = loadFavorites();

function setDisplay(el, value) {
  el.style.setProperty("display", value, "important");
  el.classList.toggle("is-hidden", value === "none");
}

function ensurePopup() {
  if (state.wrapper) return state.wrapper;

  const wrapper = document.createElement("div");
  wrapper.className = "tag-autocomplete-wrapper";
  setDisplay(wrapper, "none");

  const favoritesEl = document.createElement("div");
  favoritesEl.className = "tag-favorites-popup";
  setDisplay(favoritesEl, "none");

  const resultsEl = document.createElement("div");
  resultsEl.className = "tag-autocomplete-popup";
  setDisplay(resultsEl, "none");

  wrapper.appendChild(favoritesEl);
  wrapper.appendChild(resultsEl);
  document.body.appendChild(wrapper);

  state.wrapper = wrapper;
  state.favoritesEl = favoritesEl;
  state.resultsEl = resultsEl;
  return wrapper;
}

function createTagItemElement(tag, { highlightQuery = "", selected = false, onSelect, showFavoriteButton = true, favoriteTarget = null, hideSpacer = false, favoriteActive = null, onToggleFavorite = null } = {}) {
  const item = document.createElement("div");
  item.className = "tag-autocomplete-item";
  if (selected) item.classList.add("selected");

  const settings = getSettings();
  const favTag = favoriteTarget || tag;

  if (showFavoriteButton) {
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "tag-favorite-btn";
    const isActive = favoriteActive !== null ? favoriteActive : isFavorite(favTag);
    if (isActive) favBtn.classList.add("active");
    favBtn.textContent = "★";
    favBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleFavorite) {
        onToggleFavorite();
      } else {
        toggleFavorite(favTag);
      }

      if (state.activeElement) {
        const { fragment, fullStart } = getCurrentFragment(state.activeElement);
        const favTrigger = getSettings().favoritesDisplayMode === "trigger" ? parseFavoritesTrigger(fragment) : null;
        if (favTrigger) {
          renderFavoritesSection(favTrigger.filterText);
        } else {
          renderPopupContents();
        }
        updatePopupVisibility(state.activeElement, fullStart);
      } else {
        renderPopupContents();
      }
    });
    item.appendChild(favBtn);
  } else if (!hideSpacer) {
    const spacer = document.createElement("span");
    spacer.className = "tag-favorite-btn tag-favorite-btn-spacer";
    item.appendChild(spacer);
  }

  const nameEl = document.createElement("span");
  nameEl.className = "tag-autocomplete-name";
  const highlightFn = tag.__fuzzy ? buildFuzzyHighlightParts : buildHighlightParts;
  highlightFn(tag.name, highlightQuery).forEach((part) => {
    if (part.highlight) {
      const mark = document.createElement("mark");
      mark.className = "tag-autocomplete-highlight";
      mark.textContent = part.text;
      nameEl.appendChild(mark);
    } else {
      nameEl.appendChild(document.createTextNode(part.text));
    }
  });
  if (tag.__fuzzy) {
    const fuzzyMark = document.createElement("span");
    fuzzyMark.className = "tag-fuzzy-mark";
    fuzzyMark.textContent = " ?";
    nameEl.appendChild(fuzzyMark);
  }

  const metaEl = document.createElement("span");
  metaEl.className = "tag-autocomplete-meta";

  const catEl = document.createElement("span");
  catEl.className = "cat";
  catEl.textContent = tag.category;

  const srcEl = document.createElement("span");
  srcEl.className = "src";
  const sourceLower = (tag.source || "").toLowerCase();
  if (sourceLower) {
    srcEl.classList.add(sourceLower);
  }
  srcEl.textContent = tag.source;

  metaEl.appendChild(catEl);
  metaEl.appendChild(srcEl);

  if (Number(tag.score) > 0) {
    const scoEl = document.createElement("span");
    scoEl.className = "sco";
    scoEl.textContent = formatScore(tag.score, settings.scoreAbbreviation);
    metaEl.appendChild(scoEl);
  }

  item.appendChild(nameEl);
  item.appendChild(metaEl);

  item.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (onSelect) onSelect();
  });

  return item;
}

function renderResultsSection({ keepScroll = false } = {}) {
  ensurePopup();
  const resultsEl = state.resultsEl;
  const prevScroll = resultsEl.scrollTop;
  resultsEl.innerHTML = "";

  if (!state.suggestions.length) {
    setDisplay(resultsEl, "none");
    return;
  }

  const query = state.lastQuery || "";
  const suggestions = state.suggestions;

  let i = 0;
  while (i < suggestions.length) {
    const key = tagGroupKey(suggestions[i].name);
    let j = i + 1;
    while (j < suggestions.length && tagGroupKey(suggestions[j].name) === key) j++;

    const clusterSize = j - i;

    if (clusterSize > 1) {
      const clusterEl = document.createElement("div");
      clusterEl.className = "tag-group-cluster";

      const isClusterSelected = state.selectedIndex >= i && state.selectedIndex < j;
      if (isClusterSelected) {
        clusterEl.classList.add("selected");
      }

      const groupTags = suggestions.slice(i, j);
      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "tag-favorite-btn tag-cluster-favorite-btn";
      if (isFavoriteGroup(groupTags)) favBtn.classList.add("active");
      favBtn.textContent = "★";
      favBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavoriteGroup(groupTags);

        if (state.activeElement) {
          const { fragment, fullStart } = getCurrentFragment(state.activeElement);
          const favTrigger = getSettings().favoritesDisplayMode === "trigger" ? parseFavoritesTrigger(fragment) : null;
          if (favTrigger) {
            renderFavoritesSection(favTrigger.filterText);
          } else {
            renderPopupContents();
          }
          updatePopupVisibility(state.activeElement, fullStart);
        } else {
          renderPopupContents();
        }
      });
      clusterEl.appendChild(favBtn);

      const itemsEl = document.createElement("div");
      itemsEl.className = "tag-cluster-items";

      for (let k = i; k < j; k++) {
        const tag = suggestions[k];
        const isItemSelected = k === state.selectedIndex;
        const item = createTagItemElement(tag, {
          highlightQuery: query,
          selected: isItemSelected,
          onSelect: () => applySuggestion(k),
          showFavoriteButton: false,
          hideSpacer: true,
        });
        itemsEl.appendChild(item);
      }

      clusterEl.appendChild(itemsEl);
      resultsEl.appendChild(clusterEl);
    } else {
      const tag = suggestions[i];
      const itemIndex = i;
      const item = createTagItemElement(tag, {
        highlightQuery: query,
        selected: i === state.selectedIndex,
        onSelect: () => applySuggestion(itemIndex),
        showFavoriteButton: true,
        favoriteTarget: suggestions[i],
      });
      resultsEl.appendChild(item);
    }

    i = j;
  }

  if (state.pagination?.hasMore) {
    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "tag-show-more-btn";
    moreBtn.textContent = state.pagination.loading ? "…" : T.showMore;
    moreBtn.disabled = !!state.pagination.loading;
    moreBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      loadMoreSuggestions();
    });
    resultsEl.appendChild(moreBtn);
  }

  setDisplay(resultsEl, "flex");
  resultsEl.scrollTop = keepScroll ? prevScroll : 0;
}

function renderFavoritesSection(filterText = "") {
  ensurePopup();
  const favoritesEl = state.favoritesEl;
  favoritesEl.innerHTML = "";

  const settings = getSettings();
  const showAll = settings.tagDisplayMode !== "highest";

  let favorites = getSortedFavorites();
  if (filterText) {
    favorites = favorites.filter((f) => spaceifyTagName(f.name).toLowerCase().includes(filterText));
  }

  if (!favorites.length) {
    setDisplay(favoritesEl, "none");
    return;
  }

  const groups = [];
  const groupIndexByKey = new Map();
  favorites.forEach((tag) => {
    const key = tagGroupKey(tag.name);
    if (!groupIndexByKey.has(key)) {
      groupIndexByKey.set(key, groups.length);
      groups.push([]);
    }
    groups[groupIndexByKey.get(key)].push(tag);
  });

  groups.forEach((group) => {
    group.sort(compareClusterTags);

    if (showAll && group.length > 1) {
      const clusterEl = document.createElement("div");
      clusterEl.className = "tag-group-cluster";

      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "tag-favorite-btn tag-cluster-favorite-btn active";
      favBtn.textContent = "★";
      favBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavoriteGroup(group);
        renderFavoritesSection(filterText);
      });
      clusterEl.appendChild(favBtn);

      const itemsEl = document.createElement("div");
      itemsEl.className = "tag-cluster-items";
      group.forEach((tag) => {
        const item = createTagItemElement(tag, {
          highlightQuery: "",
          selected: false,
          onSelect: () => applyTag(tag),
          showFavoriteButton: false,
          hideSpacer: true,
        });
        itemsEl.appendChild(item);
      });
      clusterEl.appendChild(itemsEl);
      favoritesEl.appendChild(clusterEl);
    } else {
      const representative = group[0];
      const item = createTagItemElement(representative, {
        highlightQuery: "",
        selected: false,
        onSelect: () => applyTag(representative),
        favoriteActive: true,
        onToggleFavorite: () => toggleFavoriteGroup(group),
      });
      favoritesEl.appendChild(item);
    }
  });

  setDisplay(favoritesEl, "flex");
}

function renderPopupContents() {
  const settings = getSettings();
  if (settings.favoritesDisplayMode === "focus") {
    renderFavoritesSection();
  } else {
    ensurePopup();
    setDisplay(state.favoritesEl, "none");
  }
  renderResultsSection();
}

function updatePopupVisibility(el, anchorIndex) {
  const wrapper = ensurePopup();
  const hasFavorites = !state.favoritesEl.classList.contains("is-hidden");
  const hasResults = !state.resultsEl.classList.contains("is-hidden");

  if (!hasFavorites && !hasResults) {
    setDisplay(wrapper, "none");
    return;
  }

  setDisplay(wrapper, "flex");
  positionPopup(el, anchorIndex);
}

function closePopup() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  hideSearchOverlay();
  state.suggestions = [];
  state.selectedIndex = -1;
  if (state.wrapper) setDisplay(state.wrapper, "none");
}

function showSuggestions(el, anchorIndex, suggestions) {
  state.suggestions = suggestions;
  state.selectedIndex = suggestions.length ? 0 : -1;
  renderPopupContents();
  updatePopupVisibility(el, anchorIndex);
  if (state.resultsEl) state.resultsEl.scrollTop = 0;
  if (state.wrapper) state.wrapper.scrollTop = 0;
}

function clearSearchResults(el, anchorIndex) {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  hideSearchOverlay();
  state.suggestions = [];
  state.selectedIndex = -1;
  renderPopupContents();
  updatePopupVisibility(el, anchorIndex);
}

function showFavoritesPanel(el, anchorIndex, filterText) {
  ensurePopup();
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  hideSearchOverlay();
  state.suggestions = [];
  state.selectedIndex = -1;
  state.resultsEl.innerHTML = "";
  setDisplay(state.resultsEl, "none");
  renderFavoritesSection(filterText);
  updatePopupVisibility(el, anchorIndex);
}

function applyTag(tag) {
  const el = state.activeElement;
  if (!el || !tag) return;

  if (document.activeElement !== el) {
    closePopup();
    return;
  }

  const settings = getSettings();
  const { fullStart, fullEnd } = getCurrentFragment(el);
  const value = el.value ?? "";

  let before = value.slice(0, fullStart);
  let after = value.slice(fullEnd);

  let tagText = normalizeTagText(tag.name);
  if (settings.artistPrefix && tag.category && tag.category.toLowerCase() === "artist") {
    tagText = `${settings.artistPrefix}${tagText}`;
  }

  const delimiterChar = settings.delimiter === "none" ? "" : settings.delimiter;

  const insideWeightParen = /(?<!\\)\($/.test(before);
  const weightParenMatch = insideWeightParen ? /^([^()]*)\)/.exec(after) : null;

  let insertText = "";
  let newCaret = 0;

  if (weightParenMatch) {
    before = before.slice(0, -1);

    const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
    const leadingSpace = needsLeadingSpace ? " " : "";

    const weightContent = weightParenMatch[1];
    const restAfter = after.slice(weightParenMatch[0].length);

    const hasTrailingComma = /^[ \t]*,/.test(restAfter);

    if (hasTrailingComma && delimiterChar === ",") {
      insertText = `${leadingSpace}(${tagText}${weightContent})`;

      const hasNewlineAfterComma = /^[ \t]*,[ \t]*\r?\n/.test(restAfter);
      if (hasNewlineAfterComma) {
        after = restAfter.replace(/^[ \t]*,[ \t]*/, ",");
        newCaret = before.length + insertText.length + 1;
      } else {
        after = restAfter.replace(/^[ \t]*,[ \t]*/, ", ");
        newCaret = before.length + insertText.length + 2;
      }
    } else {
      const needsTrailingSpace = !/^\s/.test(restAfter);
      const trailingSpace = needsTrailingSpace ? " " : "";
      insertText = `${leadingSpace}(${tagText}${weightContent})${delimiterChar}${trailingSpace}`;
      after = restAfter;

      newCaret = before.length + insertText.length;
    }
  } else {
    const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
    const leadingSpace = needsLeadingSpace ? " " : "";

    const hasTrailingComma = /^[ \t]*,/.test(after);

    if (hasTrailingComma && delimiterChar === ",") {
      insertText = `${leadingSpace}${tagText}`;

      const hasNewlineAfterComma = /^[ \t]*,[ \t]*\r?\n/.test(after);

      if (hasNewlineAfterComma) {
        after = after.replace(/^[ \t]*,[ \t]*/, ",");
        newCaret = before.length + insertText.length + 1;
      } else {
        after = after.replace(/^[ \t]*,[ \t]*/, ", ");
        newCaret = before.length + insertText.length + 2;
      }
    } else {
      const needsTrailingSpace = !/^\s/.test(after);
      const trailingSpace = needsTrailingSpace ? " " : "";
      insertText = `${leadingSpace}${tagText}${delimiterChar}${trailingSpace}`;

      newCaret = before.length + insertText.length;
    }
  }

  const newValue = `${before}${insertText}${after}`;

  setElementValue(el, newValue, newCaret);
  closePopup();
}

function applySuggestion(index) {
  applyTag(state.suggestions[index]);
}

function setElementValue(el, value, caret) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.setSelectionRange?.(caret, caret);
  el.focus();
}

function countUniqueTags(tags) {
  return new Set(tags.map((t) => tagGroupKey(t.name))).size;
}

function appendUniqueTags(base, incoming, markFuzzy = false) {
  const seen = new Set(base.map(tagResultKey));
  const result = base.slice();
  for (const tag of incoming) {
    const key = tagResultKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(markFuzzy ? { ...tag, __fuzzy: true } : tag);
  }
  return result;
}

async function fetchSuggestions(parsed, settings, signal, { offset = 0, permuted = false } = {}) {
  const empty = { results: [], hasMore: false, nextOffset: offset };
  try {
    const params = new URLSearchParams({
      q: parsed.query,
      limit: String(settings.maxSuggestions),
    });
    if (offset > 0) params.set("offset", String(offset));

    const activeSources = getActiveSources();
    if (activeSources.length > 0) {
      params.set("source", activeSources.join(","));
    }

    if (parsed.category) {
      params.set("category", parsed.category);
    } else if (!settings.showDeprecated) {
      params.set("exclude_category", "deprecated");
    }
    if (permuted) params.set("permuted", "1");
    const res = await api.fetchApi(`/anima_tag_completer/search?${params.toString()}`, { signal });
    if (!res.ok) return empty;
    const data = await res.json();
    return {
      results: Array.isArray(data.results) ? data.results : [],
      hasMore: !!data.has_more,
      nextOffset: Number(data.next_offset) || offset,
    };
  } catch (e) {
    if (e.name === "AbortError") return empty;
    console.error("[AnimaTagCompleter]", e);
    return empty;
  }
}

const FUZZY_TRIGGER_MAX = 5;

function tagResultKey(tag) {
  return `${tag.source}::${tag.category}::${tag.name}`.toLowerCase();
}

function compareClusterTags(a, b) {
  const aIsTC = String(a?.source ?? "").toLowerCase() === "thetacursed";
  const bIsTC = String(b?.source ?? "").toLowerCase() === "thetacursed";
  if (aIsTC && !bIsTC) return -1;
  if (!aIsTC && bIsTC) return 1;
  return Number(b?.score ?? 0) - Number(a?.score ?? 0);
}

function reduceToHighestScore(suggestions) {
  const bestByKey = new Map();
  const order = [];

  for (const tag of suggestions) {
    const key = tagGroupKey(tag.name);
    const current = bestByKey.get(key);
    if (!current) {
      order.push(key);
      bestByKey.set(key, tag);
    } else if (compareClusterTags(tag, current) < 0) {
      bestByKey.set(key, tag);
    }
  }

  return order.map((key) => bestByKey.get(key));
}

async function fetchSuggestionsWithFallback(parsed, settings, signal) {
  const wordCount = parsed.query.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < 2) {
    const primary = await fetchSuggestions(parsed, settings, signal);
    return { suggestions: primary.results, hasMore: primary.hasMore, nextOffset: primary.nextOffset, mode: "primary" };
  }

  const [primary, fuzzy] = await Promise.all([fetchSuggestions(parsed, settings, signal), fetchSuggestions(parsed, settings, signal, { permuted: true })]);

  if (signal?.aborted || primary.hasMore || countUniqueTags(primary.results) > FUZZY_TRIGGER_MAX) {
    return { suggestions: primary.results, hasMore: primary.hasMore, nextOffset: primary.nextOffset, mode: "primary" };
  }

  return {
    suggestions: appendUniqueTags(primary.results, fuzzy.results, true),
    hasMore: fuzzy.hasMore,
    nextOffset: fuzzy.nextOffset,
    mode: "fuzzy",
  };
}

async function loadMoreSuggestions() {
  const pg = state.pagination;
  const el = state.activeElement;
  if (!pg || !pg.hasMore || pg.loading || !el || !state.suggestions.length) return;

  pg.loading = true;
  renderResultsSection({ keepScroll: true });

  if (state.abortController) state.abortController.abort();
  state.abortController = new AbortController();
  const signal = state.abortController.signal;
  const requestId = state.requestId;
  const settings = getSettings();

  try {
    const page = await fetchSuggestions(pg.parsed, settings, signal, {
      offset: pg.offset,
      permuted: pg.mode === "fuzzy",
    });

    if (signal.aborted || state.pagination !== pg || requestId !== state.requestId || !state.suggestions.length) return;

    const combined = appendUniqueTags(state.suggestions, page.results, pg.mode === "fuzzy");
    state.suggestions = settings.tagDisplayMode === "highest" ? reduceToHighestScore(combined) : combined;
    pg.offset = page.nextOffset;
    pg.hasMore = page.hasMore;
  } finally {
    if (state.pagination === pg) pg.loading = false;
  }

  renderResultsSection({ keepScroll: true });
  updatePopupVisibility(el, getCurrentFragment(el).fullStart);
}

let inputTimer = null;

async function handleInput(e) {
  try {
    const settings = getSettings();
    if (!settings.enabled) return;

    const el = e.target;
    if (!isTextWidget(el)) return;

    if (inputTimer) clearTimeout(inputTimer);

    inputTimer = setTimeout(async () => {
      state.activeElement = el;
      const { fragment, fullStart } = getCurrentFragment(el);

      if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
      }

      const requestId = ++state.requestId;
      state.pagination = null;

      const favTrigger = settings.favoritesDisplayMode === "trigger" ? parseFavoritesTrigger(fragment) : null;
      if (favTrigger) {
        showFavoritesPanel(el, fullStart, favTrigger.filterText);
        return;
      }

      const parsed = parseCategoryFilter(fragment);
      if (parsed.pending) {
        clearSearchResults(el, fullStart);
        return;
      }

      const effectiveMinChars = parsed.category ? 0 : settings.minChars;

      if (parsed.query.length < effectiveMinChars) {
        clearSearchResults(el, fullStart);
        return;
      }

      state.abortController = new AbortController();
      const signal = state.abortController.signal;

      ensurePopup();
      setDisplay(state.wrapper, "flex");
      setDisplay(state.resultsEl, "flex");
      if (settings.favoritesDisplayMode === "focus" && state.favorites.length) {
        setDisplay(state.favoritesEl, "flex");
      }
      positionPopup(el, fullStart);
      showSearchOverlay();

      try {
        const result = await fetchSuggestionsWithFallback(parsed, settings, signal);

        if (signal.aborted || state.activeElement !== el || requestId !== state.requestId) return;

        const { fullStart: currentStart } = getCurrentFragment(el);

        state.lastQuery = parsed.query;
        state.pagination = {
          parsed,
          mode: result.mode,
          offset: result.nextOffset,
          hasMore: result.hasMore,
          loading: false,
        };
        showSuggestions(el, currentStart, settings.tagDisplayMode === "highest" ? reduceToHighestScore(result.suggestions) : result.suggestions);
      } catch (err) {
        console.error("[AnimaTagCompleter]", err);
      } finally {
        if (requestId === state.requestId) {
          hideSearchOverlay();
        }
      }
    }, 100);
  } catch (err) {}
}

function getSuggestionGroups() {
  const suggestions = state.suggestions;
  const groups = [];
  let i = 0;
  while (i < suggestions.length) {
    const key = tagGroupKey(suggestions[i].name);
    let j = i + 1;
    while (j < suggestions.length && tagGroupKey(suggestions[j].name) === key) j++;
    groups.push([i, j]);
    i = j;
  }
  return groups;
}

function handleKeydown(e) {
  try {
    if (!state.wrapper || state.wrapper.classList.contains("is-hidden")) return;

    if (e.key === "Escape") {
      closePopup();
      return;
    }

    if (!state.suggestions.length) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const groups = getSuggestionGroups();
        const currentGroupIdx = groups.findIndex(([start, end]) => state.selectedIndex >= start && state.selectedIndex < end);
        const nextGroupIdx = currentGroupIdx === -1 ? 0 : (currentGroupIdx + 1) % groups.length;
        state.selectedIndex = groups[nextGroupIdx][0];
        renderResultsSection();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const groups = getSuggestionGroups();
        const currentGroupIdx = groups.findIndex(([start, end]) => state.selectedIndex >= start && state.selectedIndex < end);
        const prevGroupIdx = currentGroupIdx === -1 ? groups.length - 1 : (currentGroupIdx - 1 + groups.length) % groups.length;
        state.selectedIndex = groups[prevGroupIdx][0];
        renderResultsSection();
        break;
      }
      case "Enter":
      case "Tab":
        if (state.selectedIndex >= 0) {
          e.preventDefault();
          applySuggestion(state.selectedIndex);
        }
        break;
    }
  } catch (err) {}
}

function handleFocusIn(e) {
  try {
    const settings = getSettings();
    if (!settings.enabled) return;

    const el = e.target;
    if (!isTextWidget(el)) return;

    state.activeElement = el;

    if (settings.favoritesDisplayMode !== "focus" || !state.favorites.length) return;

    state.suggestions = [];
    state.selectedIndex = -1;
    renderPopupContents();
    const { fullStart } = getCurrentFragment(el);
    updatePopupVisibility(el, fullStart);
  } catch (err) {}
}

function handleFocusOut(e) {
  try {
    const leavingElement = e.target;
    setTimeout(() => {
      if (state.wrapper && !state.wrapper.matches(":hover")) {
        if (state.activeElement === leavingElement) {
          closePopup();
        }
      }
    }, 100);
  } catch (err) {}
}

function handleGlobalPointerDown(e) {
  try {
    if (!state.wrapper || state.wrapper.classList.contains("is-hidden")) return;
    if (state.wrapper.contains(e.target)) return;
    closePopup();
  } catch (err) {}
}

function handleWheel(e) {
  try {
    if (!state.wrapper || state.wrapper.classList.contains("is-hidden")) return;
    if (state.wrapper.contains(e.target)) return;
    closePopup();
  } catch (err) {}
}

function handleResize() {
  try {
    closePopup();
  } catch (err) {}
}

function isEditableElement(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "TEXTAREA" || tag === "INPUT";
}

async function reloadTagDatabase() {
  try {
    const res = await api.fetchApi("/anima_tag_completer/reload", { method: "POST" });
    if (res.ok) {
      await loadCustomCategories();
    }
  } catch (err) {}
}

function handleReloadHotkey(e) {
  try {
    if (!e.key || e.key.toLowerCase() !== "r") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isEditableElement(document.activeElement)) return;
    reloadTagDatabase();
  } catch (err) {}
}

function injectStyles() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./anima_tag_completer.css", import.meta.url);
  document.head.appendChild(link);
}

function showSearchOverlay(target) {
  const popups = target ? (typeof target === "string" ? document.querySelectorAll(target) : [target]) : document.querySelectorAll(".tag-autocomplete-popup, .tag-favorites-popup");

  popups.forEach((popup) => {
    if (!popup) return;

    if (!popup.querySelector(".tag-autocomplete-searching")) {
      const overlay = document.createElement("div");
      overlay.className = "tag-autocomplete-searching";

      const icon = document.createElement("div");
      icon.className = "search-icon";
      icon.textContent = "👀";

      overlay.appendChild(icon);
      popup.appendChild(overlay);
    }
  });
}

function hideSearchOverlay(target) {
  if (target) {
    const popup = typeof target === "string" ? document.querySelector(target) : target;
    const overlay = popup?.querySelector(".tag-autocomplete-searching");
    overlay?.remove();
  } else {
    document.querySelectorAll(".tag-autocomplete-searching").forEach((el) => el.remove());
  }
}

let listenersAttached = false;

function attachListeners() {
  if (listenersAttached) return;
  document.addEventListener("input", handleInput, true);
  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("keydown", handleReloadHotkey, true);
  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("focusout", handleFocusOut, true);
  document.addEventListener("mousedown", handleGlobalPointerDown, true);
  window.addEventListener("wheel", handleWheel, { passive: true, capture: true });
  window.addEventListener("resize", handleResize, true);
  window.addEventListener("beforeunload", detachListeners);
  listenersAttached = true;
}

function detachListeners() {
  if (!listenersAttached) return;
  document.removeEventListener("input", handleInput, true);
  document.removeEventListener("keydown", handleKeydown, true);
  document.removeEventListener("keydown", handleReloadHotkey, true);
  document.removeEventListener("focusin", handleFocusIn, true);
  document.removeEventListener("focusout", handleFocusOut, true);
  document.removeEventListener("mousedown", handleGlobalPointerDown, true);
  window.removeEventListener("wheel", handleWheel, { passive: true, capture: true });
  window.removeEventListener("resize", handleResize, true);
  window.removeEventListener("beforeunload", detachListeners);
  listenersAttached = false;
}

app.registerExtension({
  name: EXTENSION_NAME,

  settings: [
    {
      id: "AnimaTagCompleter.Language",
      name: T.language.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "0. Interface language"],
      type: "combo",
      defaultValue: "en",
      options: [
        { text: T.language.options.en, value: "en" },
        { text: T.language.options.ru, value: "ru" },
      ],
      tooltip: T.language.tooltip,
    },
    {
      id: "AnimaTagCompleter.Enabled",
      name: T.enable.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "1. Enable this extension"],
      type: "boolean",
      defaultValue: true,
      tooltip: T.enable.tooltip,
    },
    {
      id: "AnimaTagCompleter.Source.Danbooru",
      name: T.sources.danbooru.name,
      category: ["AnimaTagCompleter", "tags source", "1. Danbooru"],
      type: "boolean",
      defaultValue: true,
      tooltip: T.sources.danbooru.tooltip,
    },
    {
      id: "AnimaTagCompleter.Source.Gelbooru",
      name: T.sources.gelbooru.name,
      category: ["AnimaTagCompleter", "tags source", "2. Gelbooru"],
      type: "boolean",
      defaultValue: true,
      tooltip: T.sources.gelbooru.tooltip,
    },
    {
      id: "AnimaTagCompleter.Source.Safebooru",
      name: T.sources.safebooru.name,
      category: ["AnimaTagCompleter", "tags source", "3. Safebooru"],
      type: "boolean",
      defaultValue: false,
      tooltip: T.sources.safebooru.tooltip,
    },
    {
      id: "AnimaTagCompleter.Source.ThetaCursed",
      name: T.sources.thetacursed.name,
      category: ["AnimaTagCompleter", "tags source", "4. ThetaCursed"],
      type: "boolean",
      defaultValue: true,
      tooltip: T.sources.thetacursed.tooltip,
    },
    {
      id: "AnimaTagCompleter.OpenCustom",
      name: T.openCustom.name,
      category: ["AnimaTagCompleter", "tags source", "5. Open Custom"],
      tooltip: T.openCustom.tooltip,
      type: () => {
        const btn = document.createElement("button");
        btn.textContent = T.openCustom.button;
        btn.style.cssText = "padding:4px 12px;cursor:pointer;";
        btn.addEventListener("click", async () => {
          try {
            await api.fetchApi("/anima_tag_completer/open_custom", { method: "POST" });
          } catch (err) {}
        });
        return btn;
      },
    },
    {
      id: "AnimaTagCompleter.FavoritesDisplayMode",
      name: T.favMode.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "3. Favorite tags display mode"],
      type: "combo",
      defaultValue: "trigger",
      options: [
        { text: T.favMode.options.trigger, value: "trigger" },
        { text: T.favMode.options.focus, value: "focus" },
      ],
      tooltip: T.favMode.tooltip,
    },
    {
      id: "AnimaTagCompleter.ShowDeprecated",
      name: T.showDeprecated.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "4. Show tags from the 'Deprecated' category"],
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "AnimaTagCompleter.ScoreAbbreviation",
      name: T.scoreAbbr.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "5. Score abbreviation (K/M/B)"],
      type: "boolean",
      defaultValue: true,
      tooltip: T.scoreAbbr.tooltip,
    },
    {
      id: "AnimaTagCompleter.MinChars",
      name: T.minChars.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "6. Minimum characters to trigger search"],
      type: "number",
      defaultValue: 2,
      tooltip: T.minChars.tooltip,
    },
    {
      id: "AnimaTagCompleter.MaxSuggestions",
      name: T.maxSuggestions.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "7. Maximum number of suggestions"],
      type: "number",
      defaultValue: 30,
    },
    {
      id: "AnimaTagCompleter.Delimiter",
      name: T.delimiter.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "8. Delimiter type"],
      type: "combo",
      defaultValue: ",",
      options: [
        { text: T.delimiter.options.comma, value: "," },
        { text: T.delimiter.options.period, value: "." },
        { text: T.delimiter.options.none, value: "none" },
      ],
      tooltip: T.delimiter.tooltip,
    },
    {
      id: "AnimaTagCompleter.ArtistPrefix",
      name: T.artistPrefix.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "9. Artist tag prefix"],
      type: "text",
      defaultValue: "@",
      tooltip: T.artistPrefix.tooltip,
    },
    {
      id: "AnimaTagCompleter.TagDisplayMode",
      name: T.tagDisplayMode.name,
      category: ["AnimaTagCompleter", "AnimaTagCompleter", "10. Tag display mode"],
      type: "combo",
      defaultValue: "highest",
      options: [
        { text: T.tagDisplayMode.options.all, value: "all" },
        { text: T.tagDisplayMode.options.highest, value: "highest" },
      ],
      tooltip: T.tagDisplayMode.tooltip,
    },
  ].reverse(),

  setup() {
    detachListeners();
    injectStyles();
    loadCustomCategories();
    attachListeners();
  },
});
