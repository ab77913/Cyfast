from __future__ import annotations

import re
from typing import Any, Callable, Awaitable

STOPWORDS = frozenset(
    """
    a an and are as at be but by for from has have if in into is it its of on or so
    such than that the then there these they this to was were will with what which
    who whom why how when where do does did i you we our your their my please can
    could should would may might must shall not no yes
    """.split()
)


def tokenize(text: str) -> list[str]:
    if not text:
        return []
    return [
        t
        for t in re.sub(r"[^a-z0-9_\-\s]", " ", text.lower()).split()
        if len(t) > 1 and t not in STOPWORDS
    ]


def score_node(node: dict, query_tokens: list[str]) -> float:
    heading = tokenize(node.get("heading") or "")
    summary = tokenize(node.get("summary") or "")
    path = tokenize(node.get("section_path") or "")
    score = 0.0
    seen: set[str] = set()
    for t in query_tokens:
        if t in heading:
            score += 3.0
            seen.add(t)
        elif t in path:
            score += 2.0
            seen.add(t)
        elif t in summary:
            score += 1.5
            seen.add(t)
    if len(seen) > 1:
        score += 0.5 * (len(seen) - 1)
    return score
