import os
import csv
import time
import bisect
import threading

EXTENSION_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TAGS_DIR = os.path.join(EXTENSION_DIR, "tags")

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
        self._by_name_group = {}
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
                self._by_name_group = {}
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

        by_name_group = {}
        by_category = {}
        for e in final_entries:
            by_name_group.setdefault(e.name_norm, []).append(e)
            by_category.setdefault(e.category.lower(), []).append(e)

        with self._lock:
            self._entries = final_entries
            self._raw_entries = entries
            self._by_name_norm = by_name_norm
            self._by_name_norm_keys = by_name_norm_keys
            self._by_name_group = by_name_group
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
    def _make_filter(sources, categories, exclude_categories):
        sources_l = {s.lower() for s in sources} if sources else None
        cats_l = {c.lower() for c in categories} if categories else None
        excl_l = {c.lower() for c in exclude_categories} if exclude_categories else None

        def accept(e):
            if sources_l and e.source.lower() not in sources_l:
                return False
            if cats_l and e.category.lower() not in cats_l:
                return False
            if excl_l and e.category.lower() in excl_l:
                return False
            return True

        return accept

    @staticmethod
    def _group_entries(entries):
        groups = {}
        for e in entries:
            groups.setdefault(e.name_norm, []).append(e)
        result = list(groups.values())
        for g in result:
            g.sort(key=lambda e: (0 if (e.source or "").lower() == "thetacursed" else 1, -e.score))
        return result

    @staticmethod
    def _paginate(entries, limit, offset):
        groups = TagDatabase._group_entries(entries)
        page = groups[offset:offset + limit]
        has_more = len(groups) > offset + limit
        return [e for g in page for e in g], has_more

    def search(self, query, limit=20, offset=0, sources=None,
               categories=None, exclude_categories=None):
        query = (query or "").strip()
        if not query and not categories:
            return [], False

        limit = max(1, limit)
        offset = max(0, offset)
        target = offset + limit + 1  # +1 уникальный тег, чтобы понять, есть ли продолжение
        query_norm = self._normalize_for_match(query)
        accept = self._make_filter(sources, categories, exclude_categories)

        if not query_norm and categories:
            with self._lock:
                by_category = self._by_category
            candidates = []
            for cat in {c.lower() for c in categories}:
                candidates.extend(by_category.get(cat, []))
            candidates = [e for e in candidates if accept(e)]
            candidates.sort(key=lambda e: (-e.score, e.name))
            return self._paginate(candidates, limit, offset)

        starts_with = [e for e in self._prefix_candidates(query_norm) if accept(e)]
        starts_with.sort(key=lambda e: (-e.score, e.name))
        groups = self._group_entries(starts_with)

        if len(groups) < target:
            seen = {g[0].name_norm for g in groups}
            need = target - len(groups)
            with self._lock:
                entries = self._entries
                by_group = self._by_name_group

            found = []
            for e in entries:
                n = e.name_norm
                if n in seen or query_norm not in n or n.startswith(query_norm):
                    continue
                if not accept(e):
                    continue
                seen.add(n)
                found.append(n)
                if len(found) >= need:
                    break

            contains_entries = [m for n in found for m in by_group[n] if accept(m)]
            groups.extend(self._group_entries(contains_entries))

        page = groups[offset:offset + limit]
        has_more = len(groups) > offset + limit
        return [e for g in page for e in g], has_more

    def search_permuted(self, query, limit=20, offset=0, sources=None,
                        categories=None, exclude_categories=None):
        words = [self._normalize_for_match(w) for w in (query or "").split() if w.strip()]
        if len(words) < 2:
            return [], False

        limit = max(1, limit)
        offset = max(0, offset)
        target = offset + limit + 1
        accept = self._make_filter(sources, categories, exclude_categories)

        with self._lock:
            entries = self._entries
            by_group = self._by_name_group

        seen = set()
        names = []
        for e in entries:
            n = e.name_norm
            if n in seen or len(e.name_words) < len(words):
                continue
            if not accept(e):
                continue
            if not all(w in n for w in words):
                continue
            if self._words_match_permuted(words, e.name_words):
                seen.add(n)
                names.append(n)
                if len(names) >= target:
                    break

        matched = [m for n in names for m in by_group[n] if accept(m)]
        return self._paginate(matched, limit, offset)

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