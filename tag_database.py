import os
import csv
import time
import bisect
import threading

EXTENSION_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TAGS_DIR = os.path.join(EXTENSION_DIR, "tags")

CONTAINS_SCAN_MULTIPLIER = 20
PERMUTED_SCAN_MULTIPLIER = 5


class TagEntry:
    __slots__ = ("name", "score", "category", "source", "name_norm", "name_words")

    def __init__(self, name, score, category, source):
        self.name = name
        self.score = max(0.0, score)
        self.category = category
        self.source = source
        self.name_norm = TagDatabase._normalize_for_match(name)
        self.name_words = self.name_norm.split()

    def to_dict(self):
        return {
            "name": self.name,
            "score": self.score,
            "category": self.category,
            "source": self.source,
        }


class TagDatabase:
    def __init__(self, tags_dir=None):
        self.tags_dir = tags_dir or DEFAULT_TAGS_DIR
        self._entries = []
        self._raw_entries = []
        self._by_name_norm = []
        self._by_name_norm_keys = []
        self._by_category = {}
        self._lock = threading.Lock()
        self._loaded_at = 0
        self.load()

    def load(self):
        entries = []
        if not os.path.isdir(self.tags_dir):
            print(f"[AnimaTagCompleter] Tags directory not found: {self.tags_dir}")
            with self._lock:
                self._entries = []
                self._raw_entries = []
                self._by_name_norm = []
                self._by_name_norm_keys = []
                self._by_category = {}
                self._loaded_at = time.time()
            return

        for source in self._list_subdirs(self.tags_dir):
            source_path = os.path.join(self.tags_dir, source)
            csv_files = sorted(
                f for f in os.listdir(source_path) if f.lower().endswith(".csv")
            )

            for filename in csv_files:
                category = os.path.splitext(filename)[0]
                file_path = os.path.join(source_path, filename)
                entries.extend(self._parse_csv(file_path, category, source))

        deduped = {}
        for e in entries:
            key = (e.name_norm, e.category.lower(), e.source.lower())
            current = deduped.get(key)
            if current is None or e.score > current.score:
                deduped[key] = e

        final_entries = sorted(deduped.values(), key=lambda e: (-e.score, e.name))

        by_name_norm = sorted(final_entries, key=lambda e: e.name_norm)
        by_name_norm_keys = [e.name_norm for e in by_name_norm]

        by_category = {}
        for e in final_entries:
            by_category.setdefault(e.category.lower(), []).append(e)

        with self._lock:
            self._entries = final_entries
            self._raw_entries = entries
            self._by_name_norm = by_name_norm
            self._by_name_norm_keys = by_name_norm_keys
            self._by_category = by_category
            self._loaded_at = time.time()

        print(
            f"[AnimaTagCompleter] Tags loaded: {len(entries)} "
            f"(after exact-duplicate removal: {len(final_entries)}) from {self.tags_dir}"
        )

    def reload(self):
        self.load()

    @staticmethod
    def _list_subdirs(path):
        try:
            return sorted(
                d for d in os.listdir(path)
                if os.path.isdir(os.path.join(path, d))
            )
        except FileNotFoundError:
            return []

    @staticmethod
    def _parse_csv(file_path, category, source):
        result = []
        try:
            with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
                reader = csv.reader(f)
                for row in reader:
                    if not row:
                        continue
                    name = row[0].strip()
                    if not name:
                        continue
                    score = TagDatabase._parse_score(row[1] if len(row) > 1 else None)
                    result.append(TagEntry(name, score, category, source))
        except OSError as e:
            print(f"[AnimaTagCompleter] Failed to read {file_path}: {e}")
        return result

    @staticmethod
    def _parse_score(raw_value):
        if raw_value is None:
            return 0.0
        raw_value = raw_value.strip()
        if not raw_value:
            return 0.0
        try:
            return float(raw_value)
        except ValueError:
            return 0.0

    # ---------- Поиск ----------

    def _prefix_candidates(self, query_norm):
        with self._lock:
            keys = self._by_name_norm_keys
            by_name = self._by_name_norm
        if not query_norm:
            return list(by_name)
        lo = bisect.bisect_left(keys, query_norm)
        hi = bisect.bisect_left(keys, query_norm + "\uffff")
        return by_name[lo:hi]

    @staticmethod
    def _apply_filters(entries, sources, categories, exclude_categories):
        if sources:
            sources_lower = {s.lower() for s in sources}
            entries = [e for e in entries if e.source.lower() in sources_lower]
        if categories:
            categories_lower = {c.lower() for c in categories}
            entries = [e for e in entries if e.category.lower() in categories_lower]
        if exclude_categories:
            exclude_lower = {c.lower() for c in exclude_categories}
            entries = [e for e in entries if e.category.lower() not in exclude_lower]
        return entries

    def search(self, query, limit=20, sources=None,
               categories=None, exclude_categories=None):
        query = (query or "").strip()
        if not query and not categories:
            return []
        query_norm = self._normalize_for_match(query)

        if not query_norm and categories:
            candidates = []
            with self._lock:
                by_category = self._by_category
            for cat in {c.lower() for c in categories}:
                candidates.extend(by_category.get(cat, []))
            candidates = self._apply_filters(candidates, sources, None, exclude_categories)
            candidates.sort(key=lambda e: (-e.score, e.name))
            return self._group_adjacent(candidates)[:limit]

        starts_with = self._prefix_candidates(query_norm)
        starts_with = self._apply_filters(starts_with, sources, categories, exclude_categories)
        starts_with.sort(key=lambda e: (-e.score, e.name))

        contains = []
        if len(starts_with) < limit:
            need = max(1, (limit - len(starts_with))) * CONTAINS_SCAN_MULTIPLIER
            with self._lock:
                entries = self._entries
            
            sources_lower = {s.lower() for s in sources} if sources else None
            for e in entries:
                if sources_lower and e.source.lower() not in sources_lower:
                    continue
                if query_norm in e.name_norm and not e.name_norm.startswith(query_norm):
                    contains.append(e)
                    if len(contains) >= need:
                        break
            contains = self._apply_filters(contains, None, categories, exclude_categories)
            contains.sort(key=lambda e: (-e.score, e.name))

        combined = starts_with + contains
        return self._group_adjacent(combined)[:limit]

    def search_permuted(self, query, limit=20, sources=None,
                         categories=None, exclude_categories=None):
        words = [self._normalize_for_match(w) for w in (query or "").split() if w.strip()]
        if len(words) < 2:
            return []

        with self._lock:
            entries = self._entries

        entries = self._apply_filters(entries, sources, categories, exclude_categories)

        matched = []
        target = max(1, limit) * PERMUTED_SCAN_MULTIPLIER

        for e in entries:
            if len(e.name_words) < len(words):
                continue
            
            if not all(w in e.name_norm for w in words):
                continue

            if self._words_match_permuted(words, e.name_words):
                matched.append(e)
                if len(matched) >= target:
                    break

        matched.sort(key=lambda e: (-e.score, e.name))
        return self._group_adjacent(matched)[:limit]

    @staticmethod
    def _group_adjacent(entries):
        groups = {}
        order = []
        for e in entries:
            key = e.name_norm
            if key not in groups:
                groups[key] = []
                order.append(key)
            groups[key].append(e)

        result = []
        for key in order:
            group = groups[key]
            group.sort(key=lambda e: (0 if (e.source or "").lower() == "thetacursed" else 1, -e.score))
            result.extend(group)
        return result

    @staticmethod
    def _words_match_permuted(query_words, name_words):
        used = [False] * len(name_words)

        def backtrack(i):
            if i == len(query_words):
                return True
            for j, nw in enumerate(name_words):
                if used[j]:
                    continue
                if nw.startswith(query_words[i]):
                    used[j] = True
                    if backtrack(i + 1):
                        return True
                    used[j] = False
            return False

        return backtrack(0)

    @staticmethod
    def _normalize_for_match(s):
        return s.replace("_", " ").replace("(", "").replace(")", "").strip().lower()

    def list_sources(self):
        with self._lock:
            entries = self._raw_entries
        tree = {}
        for e in entries:
            cats = tree.setdefault(e.source, set())
            cats.add(e.category)

        for source in self._list_subdirs(self.tags_dir):
            if source not in tree:
                tree[source] = set()

        return {source: sorted(cats) for source, cats in tree.items()}

    @property
    def size(self):
        with self._lock:
            return len(self._entries)


tag_database = TagDatabase()