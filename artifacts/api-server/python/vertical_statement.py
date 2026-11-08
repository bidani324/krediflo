"""Recover date-anchored rows in vertically separated, unruled statements."""
import re
from bisect import bisect_right


def word_lines(words):
    lines = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if lines and abs(lines[-1][0]["top"] - word["top"]) < 2:
            lines[-1].append(word)
        else:
            lines.append([word])
    return lines


def vertical_word_tables(page, classify_column, read_date):
    """Use actual vertical rules, not centred header text, as column bounds.

    Only handle a complete, unambiguous header with persistent vertical rules
    and no horizontal body-row separators. Fully ruled tables stay on the
    existing grid parser. Invalid dated financial rows remain for validation.
    """
    lines = word_lines(page.extract_words())
    required = {"date", "description", "debit", "credit", "balance"}
    for header in lines:
        marks = {}
        ordered = sorted(header, key=lambda item: item["x0"])
        for index, word in enumerate(ordered):
            role = classify_column(word["text"])
            if role == "date" and index and ordered[index - 1]["text"].lower() == "value":
                continue
            if role in required and role not in marks:
                marks[role] = (word["x0"] + word["x1"]) / 2
        if marks.keys() != required:
            continue
        top = min(word["top"] for word in header)
        header_bottom = max(word["bottom"] for word in header)
        rules = [edge for edge in page.edges if edge["orientation"] == "v"
                 and top - 12 <= edge["top"] <= header_bottom + 40
                 and edge["bottom"] - edge["top"] >= 10]
        xs = []
        for x in sorted({round(edge["x0"], 3) for edge in rules}):
            if not xs or x - xs[-1] > 1:
                xs.append(x)
        if len(xs) < 6:
            continue
        mapping = {role: bisect_right(xs, x) - 1 for role, x in marks.items()}
        if len(set(mapping.values())) != len(required) or any(
            index < 0 or index >= len(xs) - 1 for index in mapping.values()
        ):
            continue
        bottom = max(edge["bottom"] for edge in rules)
        body = []
        balances = []
        for line in lines:
            y = min(word["top"] for word in line)
            if y <= header_bottom + 1 or y > bottom + 1:
                continue
            cells = [""] * (len(xs) - 1)
            for word in sorted(line, key=lambda item: item["x0"]):
                column = bisect_right(xs, (word["x0"] + word["x1"]) / 2) - 1
                if 0 <= column < len(cells):
                    cells[column] = (cells[column] + " " + word["text"]).strip()
            label = cells[mapping["description"]].strip().lower()
            if label in ("opening balance", "closing balance"):
                balances.append((label.split()[0], cells[mapping["balance"]]))
                body.append((y, cells, True))
            else:
                body.append((y, cells, False))
        anchors = [index for index, (_, cells, marker) in enumerate(body) if not marker and (
            read_date(cells[mapping["date"]]) or (
                cells[mapping["date"]] and any(
                    re.search(r"\d", cells[mapping[role]]) for role in ("debit", "credit", "balance")
                )
            )
        )]
        if not anchors:
            continue
        first_y, last_y = body[anchors[0]][0], body[anchors[-1]][0]
        if any(edge["orientation"] == "h" and first_y + 1 < edge["top"] < last_y - 1
               and edge["x0"] <= xs[0] + 3 and edge["x1"] >= xs[-1] - 3
               for edge in page.edges):
            continue
        headers = [""] * (len(xs) - 1)
        for role, column in mapping.items():
            headers[column] = role
        rows = []
        for index, start in enumerate(anchors):
            stop = anchors[index + 1] if index + 1 < len(anchors) else len(body)
            row = [""] * len(headers)
            for _, cells, marker in body[start:stop]:
                if marker:
                    break
                for column, value in enumerate(cells):
                    if value:
                        row[column] = (row[column] + " " + value).strip()
            rows.append(row)
        return [[headers, *rows]], balances, len(anchors)
    return [], [], 0
