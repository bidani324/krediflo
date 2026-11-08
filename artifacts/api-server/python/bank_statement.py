"""Extract text-based bank statement transactions. No network calls or file retention."""
import io
import json
import re
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation

import pdfplumber
from pdfminer.pdfdocument import PDFPasswordIncorrect
from vertical_statement import vertical_word_tables


def column_name(value):
    value = re.sub(r"\s+", " ", str(value or "").lower()).strip()
    if value in ("#", "s no.", "s no", "s.no.", "serial no.", "serial number"):
        return "sequence"
    if "value date" in value:
        return None
    if "date" in value:
        return "date"
    if any(word in value for word in ("description", "particular", "narration", "details", "remarks")):
        return "description"
    if "balance" in value:
        return "balance"
    if re.search(r"(debit\s*/\s*credit|credit\s*/\s*debit)", value):
        return "amount"
    if any(word in value for word in ("debit", "withdraw", "paid out")):
        return "debit"
    if any(word in value for word in ("credit", "deposit", "paid in")):
        return "credit"
    return None


def header_map(row):
    mapping = {}
    for index, cell in enumerate(row):
        name = column_name(cell)
        if name and name not in mapping:
            mapping[name] = index
    required = {"date", "description", "balance"}
    return mapping if required <= mapping.keys() and (
        {"debit", "credit"} <= mapping.keys() or "amount" in mapping
    ) else None


def parse_date(value):
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    # Some bank cells put the transaction time below the date.
    value = re.sub(r"\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?$", "", value, flags=re.I)
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y", "%d-%m-%y",
                "%Y-%m-%d", "%Y/%m/%d", "%d %b %Y", "%d-%b-%Y", "%d %b %y",
                "%d-%b-%y", "%d %B %Y", "%d/%b/%Y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def money(value, allow_empty=True):
    text = re.sub(r"\s+", "", str(value or ""))
    if text.lower() in ("", "-", "--", "nil", "na", "n/a"):
        if allow_empty:
            return Decimal("0")
        raise ValueError("A transaction balance is missing; a reliable balance analysis cannot be generated.")
    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1]
    if re.search(r"(?i)dr\.?$", text):
        negative = True
    text = re.sub(r"(?i)(cr|dr)\.?$", "", text)
    text = re.sub(r"(?i)^(inr|rs\.?|₹)", "", text).replace(",", "")
    if not re.fullmatch(r"[+-]?\d+(?:\.\d{1,2})?", text):
        raise ValueError("An amount in the statement could not be read reliably. Please use an original bank PDF with separate debit and credit columns.")
    try:
        amount = Decimal(text)
    except InvalidOperation:
        raise ValueError("The statement contains an unreadable amount.")
    if abs(amount) > Decimal("1000000000000"):
        raise ValueError("A statement amount exceeds the supported range.")
    return -abs(amount) if negative else amount


def rows_from_tables(tables, prior_mapping=None, prior_width=None, previous_row=None):
    result = []
    mapping = prior_mapping
    width = prior_width
    for table in tables:
        # Ignore unrelated summary tables even when another table had a header.
        has_header = any(header_map(row) for row in table)
        if not has_header and (not mapping or not table or len(table[0]) != width):
            continue
        for row in table:
            found = header_map(row)
            if found:
                mapping, width = found, len(row)
                continue
            if not mapping or len(row) != width:
                continue
            cells = {key: row[index] for key, index in mapping.items()}
            date = parse_date(cells["date"])
            description = re.sub(r"\s+", " ", str(cells["description"] or "")).strip()
            if not date:
                if header_map(row) or not any(row):
                    continue
                # Ignore balance/summary rows, not actual dated transactions.
                if re.search(r"(?i)opening|closing|total|brought forward|carried forward", " ".join(str(x or "") for x in row)):
                    continue
                amounts = [str(cells.get(k) or "").strip() for k in ("debit", "credit", "amount", "balance")]
                if str(cells["date"] or "").strip() and any(re.search(r"\d", a) for a in amounts):
                    raise ValueError("A transaction date could not be read. Partial financial reports are not generated.")
                prior = result[-1] if result else previous_row
                if prior and description and not any(re.search(r"\d", a) for a in amounts):
                    prior["description"] += " " + description
                continue
            if "amount" in cells:
                raw_amount = re.sub(r"\s+", "", str(cells["amount"] or ""))
                if not re.match(r"^[+-]", raw_amount) and not re.search(r"(?i)(cr|dr)\.?$", raw_amount):
                    raise ValueError("A combined Debit/Credit amount has no sign or Cr/Dr indicator. Partial financial reports are not generated.")
                amount = money(raw_amount, allow_empty=False)
                debit, credit = max(-amount, Decimal("0")), max(amount, Decimal("0"))
            else:
                debit, credit = money(cells["debit"]), money(cells["credit"])
            balance = money(cells["balance"], allow_empty=False)
            if debit < 0 or credit < 0:
                raise ValueError("Negative debit or credit entries require a bank-specific parser; this layout is not supported.")
            if debit and credit:
                raise ValueError("A row contains both debit and credit amounts. Please check the PDF column layout.")
            if not debit and not credit and re.search(r"(?i)opening|closing|brought forward|carried forward", description):
                continue
            if not description:
                raise ValueError("A transaction narration is missing. Please use a readable original statement.")
            result.append({
                "date": date, "description": description,
                "debit": float(debit), "credit": float(credit), "balance": float(balance),
            })
    return result, mapping, width


def header_grid_tables(page):
    """Extend real header-cell boundaries through horizontally ruled body rows.

    Kotak and ICICI PDFs omit vertical body rules. Text alignment heuristics lose
    their wrapped descriptions and right-aligned amounts; the header geometry
    and actual row rules provide unambiguous cells instead.
    """
    tables, source_sequences = [], []
    for detected in page.find_tables():
        detected_rows = detected.extract()
        for index, row in enumerate(detected_rows):
            mapping = header_map(row)
            if not mapping:
                continue
            cells = [cell for cell in detected.rows[index].cells if cell]
            xs = sorted({round(x, 3) for cell in cells for x in (cell[0], cell[2])})
            if len(xs) != len(row) + 1:
                continue
            top = min(cell[1] for cell in cells)
            header_bottom = max(cell[3] for cell in cells)
            words = page.extract_words()
            if "sequence" in mapping:
                column = mapping["sequence"]
                source_sequences.extend(int(word["text"]) for word in words if (
                    word["top"] >= header_bottom - 1
                    and xs[column] - 3 <= word["x0"] and word["x1"] <= xs[column + 1] + 3
                    and word["text"].isdigit()
                ))
            if any(len(candidate) == len(row) and parse_date(candidate[mapping["date"]])
                   for candidate in detected_rows[index + 1:]):
                # Already complete ruled tables retain continuation-only rows.
                tables.append(detected_rows)
                break
            # Read dates independently from the source words, not from recovered
            # rows. The first rule after the final date closes the body; later
            # full-width sign-off/legend boxes must not extend the transaction grid.
            column = mapping["date"]
            date_lines = {}
            for word in words:
                if word["top"] >= header_bottom - 1 and (
                    xs[column] - 2 <= word["x0"] and word["x1"] <= xs[column + 1] + 2
                ):
                    date_lines.setdefault(round(word["top"], 1), []).append(word)
            date_tops = [y for y, line in date_lines.items() if parse_date(
                " ".join(word["text"] for word in sorted(line, key=lambda word: word["x0"]))
            )]
            # Only rules confined to the table width count. This excludes bank
            # page footers and avoids folding legends into the last transaction.
            by_y = {}
            for edge in page.edges:
                if edge["orientation"] == "h" and edge["top"] >= top - 1 and (
                    edge["x0"] >= xs[0] - 3 and edge["x1"] <= xs[-1] + 3
                ):
                    by_y.setdefault(round(edge["top"], 2), []).append((edge["x0"], edge["x1"]))
            boundaries = []
            for y, spans in by_y.items():
                end = xs[0]
                for left, right in sorted(spans):
                    if left > end + 3:
                        break
                    end = max(end, right)
                if end >= xs[-1] - 3:
                    boundaries.append(y)
            if not boundaries:
                continue
            after_last_date = [y for y in boundaries if date_tops and y > max(date_tops) + 1]
            bottom = min(after_last_date) if after_last_date else max(boundaries)
            if bottom <= top:
                continue
            cropped = page.crop((xs[0], top, xs[-1], bottom))
            tables.extend(cropped.extract_tables({
                "vertical_strategy": "explicit", "explicit_vertical_lines": xs,
            }))
            break
    return tables, source_sequences


def numbered_rows(tables):
    """Independent source-row counters detect dropped/duplicated numbered rows."""
    sequences = []
    for table in tables:
        mapping = None
        for row in table:
            found = header_map(row)
            if found:
                mapping = found
                continue
            if not mapping or "sequence" not in mapping:
                continue
            value = str(row[mapping["sequence"]] or "").strip()
            if value.isdigit():
                if not parse_date(row[mapping["date"]]):
                    raise ValueError("A numbered transaction has an unreadable date. Partial financial reports are not generated.")
                sequences.append(int(value))
    return sequences


def aligned_table(page, previous_starts=None):
    """Recover separate columns when text-table detection merges adjacent headers."""
    lines = []
    for word in sorted(page.extract_words(), key=lambda word: (round(word["top"]), word["x0"])):
        if lines and abs(lines[-1][0]["top"] - word["top"]) < 3:
            lines[-1].append(word)
        else:
            lines.append([word])
    starts = previous_starts
    for line in lines:
        candidates = {}
        for index, word in enumerate(line):
            name = column_name(word["text"])
            if name == "date" and index and line[index - 1]["text"].lower() == "value":
                continue
            if name and name not in candidates:
                candidates[name] = word["x0"]
        if {"date", "description", "debit", "credit", "balance"} <= candidates.keys():
            starts = sorted(candidates.items(), key=lambda item: item[1])
            break
    if not starts:
        return [], None
    table = [[name for name, _ in starts]]
    for line in lines:
        cells = [""] * len(starts)
        for word in sorted(line, key=lambda word: word["x0"]):
            column = max((i for i, (_, x) in enumerate(starts) if word["x0"] >= x - 5), default=0)
            cells[column] = (cells[column] + " " + word["text"]).strip()
        # Discard title/footer lines outside transaction area. Do not discard dated rows.
        date_index = next(i for i, (name, _) in enumerate(starts) if name == "date")
        debit_index = next(i for i, (name, _) in enumerate(starts) if name == "debit")
        credit_index = next(i for i, (name, _) in enumerate(starts) if name == "credit")
        balance_index = next(i for i, (name, _) in enumerate(starts) if name == "balance")
        # Include suspicious dated/amount rows so validation rejects them instead of producing a partial report.
        looks_transaction = cells[date_index] and (
            re.search(r"\d", cells[debit_index] + cells[credit_index]) and
            re.search(r"\d", cells[balance_index])
        )
        if any(parse_date(cell) for cell in cells) or header_map(cells) or looks_transaction:
            table.append(cells)
    return [table], starts


def extract(buffer):
    all_rows, warnings = [], []
    sequences = []
    source_sequences = []
    declared_balances = {}
    mapping, width = None, None
    starts = None
    with pdfplumber.open(io.BytesIO(buffer)) as pdf:
        if not pdf.pages:
            raise ValueError("The statement must contain at least one page.")
        for page_number, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            if not text.strip():
                raise ValueError("Scanned/image-only PDF detected. Upload an original text-based PDF from your bank; OCR is not supported.")
            # Prefer ruled tables; use alignment-based detection for borderless banks.
            vertical_tables, balances, expected_rows = vertical_word_tables(page, column_name, parse_date)
            recovered, source_numbers = (vertical_tables, []) if vertical_tables else header_grid_tables(page)
            for kind, value in balances:
                amount = money(value, allow_empty=False)
                if kind in declared_balances and declared_balances[kind] != amount:
                    raise ValueError("Multiple different account balance markers were found. Analyse one account at a time.")
                declared_balances[kind] = amount
            source_sequences.extend(source_numbers)
            tables = recovered or page.extract_tables()
            prior = all_rows[-1] if all_rows else None
            rows, next_map, next_width = rows_from_tables(tables, mapping, width, prior)
            if not rows:
                tables = page.extract_tables({
                    "vertical_strategy": "text", "horizontal_strategy": "text",
                    "intersection_x_tolerance": 10, "intersection_y_tolerance": 10,
                })
                rows, next_map, next_width = rows_from_tables(tables, mapping, width, prior)
            if not rows:
                tables, starts = aligned_table(page, starts)
                rows, next_map, next_width = rows_from_tables(tables, previous_row=prior)
            if not rows and re.search(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", text) and re.search(r"\d[\d,]*\.\d{2}", text):
                raise ValueError(f"Transactions on page {page_number} could not be extracted reliably. This bank's layout needs a dedicated parser.")
            if vertical_tables and len(rows) != expected_rows:
                raise ValueError("Not all dated transactions were extracted. Partial financial reports are not generated.")
            mapping, width = next_map, next_width
            sequences.extend(numbered_rows(tables))
            all_rows.extend(rows)
            # pdfplumber caches every page's characters/edges by default. Release
            # them as we go so long statements do not consume unbounded memory.
            page.close()
            if len(all_rows) > 20000:
                raise ValueError("Statement exceeds the 20,000-transaction limit. Upload a shorter statement.")
    if not all_rows:
        raise ValueError("No readable transactions found. Use an unlocked text-based PDF with Date, Narration/Particulars, Debit/Withdrawal, Credit/Deposit and Balance columns.")
    if sequences and (len(sequences) != len(all_rows) or sequences != list(range(sequences[0], sequences[-1] + 1))):
        raise ValueError("The statement's numbered transactions are incomplete or duplicated. Partial financial reports are not generated.")
    if source_sequences and source_sequences != sequences:
        raise ValueError("Not all numbered transactions in the PDF were extracted. Partial financial reports are not generated.")
    opening = Decimal(str(all_rows[0]["balance"])) - Decimal(str(all_rows[0]["credit"])) + Decimal(str(all_rows[0]["debit"]))
    closing = Decimal(str(all_rows[-1]["balance"]))
    for kind, actual in (("opening", opening), ("closing", closing)):
        if kind in declared_balances and abs(declared_balances[kind] - actual) > Decimal("0.01"):
            raise ValueError(f"Extracted transactions do not match the printed {kind} balance. Partial financial reports are not generated.")
    all_rows.sort(key=lambda row: row["date"])
    mismatches = 0
    for previous, current in zip(all_rows, all_rows[1:]):
        expected = Decimal(str(previous["balance"])) + Decimal(str(current["credit"])) - Decimal(str(current["debit"]))
        if abs(expected - Decimal(str(current["balance"]))) > Decimal("0.01"):
            mismatches += 1
    if mismatches:
        warnings.append(f"{mismatches} running-balance transitions did not reconcile. Review the extracted transactions before using this report for a lending decision.")
    warnings.append("Average balance is the mean of transaction closing balances, not a daily average balance.")
    warnings.append("EMI Details are narration matches for EMI, Loan or Finance; they are candidates, not confirmed loan obligations.")
    return {"transactions": all_rows, "warnings": warnings}


if __name__ == "__main__":
    try:
        # Limits supplement the parent process timeout and request/file limits.
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (270, 270))
        resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
        result = extract(sys.stdin.buffer.read(10 * 1024 * 1024 + 1))
        sys.stdout.write(json.dumps({"ok": True, **result}, allow_nan=False))
    except PDFPasswordIncorrect:
        sys.stdout.write(json.dumps({"ok": False, "error": "This PDF is password-protected. Unlock it before uploading; passwords are not retained or requested."}))
    except ValueError as error:
        sys.stdout.write(json.dumps({"ok": False, "error": str(error)}))
    except Exception:
        sys.stdout.write(json.dumps({"ok": False, "error": "The PDF could not be read. It may be damaged, encrypted or unsupported. Please use an original bank PDF."}))
