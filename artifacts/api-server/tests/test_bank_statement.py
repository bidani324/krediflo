"""Synthetic PDFs only: no customer data or real account credentials."""
import sys
import unittest
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from bank_statement import extract, header_map, money, parse_date, rows_from_tables

HEADERS = ["Date", "Particulars", "Withdrawals", "Deposits", "Balance"]
SAMPLE_PAGES = [
    [HEADERS,
     ["01/01/2026", "Salary", "", "50,000.00", "60,000.00"],
     ["05/01/2026", "Home Loan EMI", "12,500.00", "", "47,500.00"],
     ["25/01/2026", "Groceries", "1,250.50", "", "46,249.50"]],
    [HEADERS,
     ["01/02/2026", "Salary", "", "50,000.00", "96,249.50"],
     ["02/02/2026", "Finance EMI", "2,000.00", "", "94,249.50"]],
]


def statement_pdf(pages=SAMPLE_PAGES, ruled=True, xs=None, header_only_vertical=False, header_shift=0, footer=False, horizontal_rows=True):
    objects = [
        b"<< /Type /Catalog /Pages 3 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        (f"<< /Type /Pages /Count {len(pages)} /Kids [" +
         " ".join(f"{4 + i * 2} 0 R" for i in range(len(pages))) + "] >>").encode(),
    ]
    xs = xs or [25, 105, 330, 410, 490, 590]
    for index, rows in enumerate(pages):
        content = []
        if ruled:
            for x in xs:
                xx = x + header_shift
                content.append(f"{xx} 730 m {xx} {702 if header_only_vertical else 730 - len(rows) * 28} l S")
            for row in range(len(rows) + 1):
                if not horizontal_rows and row not in (0, 1, len(rows)):
                    continue
                y = 730 - row * 28
                content.append(f"{xs[0]} {y} m {xs[-1]} {y} l S")
        for row_number, row in enumerate(rows):
            for column, value in enumerate(row):
                value = value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
                for line_number, line in enumerate(value.split("\n")):
                    content.append(f"BT /F1 8 Tf 1 0 0 1 {xs[column] + 4} {716 - row_number * 28 - line_number * 9} Tm ({line}) Tj ET")
        if footer:
            y = 730 - len(rows) * 28 - 30
            content.extend([
                f"{xs[0]} {y} m {xs[-1]} {y} l S",
                f"{xs[0]} {y - 25} m {xs[-1]} {y - 25} l S",
                f"BT /F1 8 Tf 1 0 0 1 {xs[0] + 4} {y - 12} Tm (Legends and sign-off) Tj ET",
            ])
        stream = "\n".join(content).encode("ascii")
        objects.append((f"<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 2 0 R >> >> /Contents {5 + index * 2} 0 R >>").encode())
        objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream")
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(output)


class StatementTests(unittest.TestCase):
    def vertical_rows(self, closing="940.00"):
        return [
            ["Transaction Date", "Value Date", "Details", "Debit", "Credit", "Balance"],
            ["", "", "Opening Balance", "", "", "1,000.00"],
            ["01-Jul-2026", "01-Jul-2026", "Loan repayment\ncontinued reference", "100.00", "", "900.00"],
            ["01-Jul-2026", "01-Jul-2026", "Refund", "", "50.00", "950.00"],
            ["03-Jul-2026", "03-Jul-2026", "Payment", "10.00", "", "940.00"],
            ["", "", "Closing Balance", "", "", closing],
        ]

    def test_vertical_only_rules_cover_page_and_same_day_rows(self):
        cover = [["Synthetic account statement", "", "", "", "", ""]]
        result = extract(statement_pdf([cover, self.vertical_rows()], xs=[25, 100, 175, 330, 410, 490, 590],
                                       horizontal_rows=False))
        self.assertEqual(len(result["transactions"]), 3)
        self.assertEqual(result["transactions"][0]["description"], "Loan repayment continued reference")
        self.assertEqual(result["transactions"][1]["credit"], 50)
        self.assertEqual(result["transactions"][-1]["balance"], 940)
        self.assertFalse(any("did not reconcile" in warning for warning in result["warnings"]))

    def test_vertical_only_rules_printed_balance_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError, "printed closing balance"):
            extract(statement_pdf([self.vertical_rows("941.00")], xs=[25, 100, 175, 330, 410, 490, 590],
                                  horizontal_rows=False))

    def test_vertical_only_rules_invalid_date_or_missing_amount_rejected(self):
        for column, value in ((0, "31-Jul-INVALID"), (5, "")):
            rows = self.vertical_rows()
            rows[3][column] = value
            with self.assertRaises(ValueError):
                extract(statement_pdf([rows], xs=[25, 100, 175, 330, 410, 490, 590], horizontal_rows=False))

    def test_header_only_rules_signed_amount_dates_with_time_and_wrapped_narration(self):
        headers = ["#", "Transaction Date", "Value Date", "Transaction Details", "Ref No.", "Debit/Credit", "Balance"]
        rows = [headers,
                ["1", "01 Apr 2025\n01:39 PM", "01 Apr 2025", "Synthetic transfer\ncontinued narration", "TEST", "-3,500.00", "3,409.40"],
                ["2", "03 Apr 2025\n11:45 AM", "03 Apr 2025", "Loan refund", "TEST", "+1,000.00", "4,409.40"]]
        result = extract(statement_pdf([rows], xs=[19, 49, 125, 195, 335, 395, 465, 590], header_only_vertical=True))
        self.assertEqual(len(result["transactions"]), 2)
        self.assertEqual(result["transactions"][0]["debit"], 3500)
        self.assertEqual(result["transactions"][1]["credit"], 1000)
        self.assertEqual(result["transactions"][0]["description"], "Synthetic transfer continued narration")

    def test_150_pages_header_only_rules_and_final_page_shift_with_legend(self):
        headers = ["S No.", "Transaction\nDate", "Cheque Number", "Transaction Remarks",
                   "Withdrawal\nAmount (INR)", "Deposit\nAmount (INR)", "Balance\n(INR)"]
        pages = [[headers, [str(i), "10.08.2025", "", "Synthetic payment\ncontinued narration",
                            "1.00", "", str(1000 - i) + ".00"]] for i in range(1, 151)]
        result = extract(statement_pdf(pages, xs=[19, 49, 119, 189, 390, 456, 522, 574],
                                       header_only_vertical=True, header_shift=1.5, footer=True))
        self.assertEqual(len(result["transactions"]), 150)
        self.assertEqual(result["transactions"][-1]["balance"], 850)
        self.assertFalse(any("did not reconcile" in warning for warning in result["warnings"]))
        self.assertNotIn("Legends", result["transactions"][-1]["description"])

    def test_numbered_transaction_gaps_rejected(self):
        headers = ["S No.", *HEADERS]
        rows = [headers, ["1", *SAMPLE_PAGES[0][1]], ["3", *SAMPLE_PAGES[0][2]]]
        with self.assertRaisesRegex(ValueError, "incomplete"):
            extract(statement_pdf([rows], xs=[19, 49, 119, 330, 410, 490, 590], header_only_vertical=True))

    def test_unreadable_trailing_numbered_transaction_cannot_be_silently_dropped(self):
        headers = ["S No.", *HEADERS]
        rows = [headers, ["1", *SAMPLE_PAGES[0][1]],
                ["2", "31/02/2026", "Synthetic payment", "100.00", "", "59900.00"]]
        with self.assertRaises(ValueError):
            extract(statement_pdf([rows], xs=[19, 49, 119, 330, 410, 490, 590], header_only_vertical=True))

    def test_unsigned_combined_amount_cannot_be_guessed(self):
        headers = ["Date", "Details", "Debit/Credit", "Balance"]
        with self.assertRaisesRegex(ValueError, "no sign"):
            rows_from_tables([[headers, ["01/01/2026", "Payment", "100.00", "900.00"]]])

    def test_cross_page_narration_continuation(self):
        previous = {"description": "Home"}
        rows_from_tables([[HEADERS, ["", "Loan EMI", "", "", ""]]], previous_row=previous)
        self.assertEqual(previous["description"], "Home Loan EMI")

    def test_real_pdf_extraction_with_repeated_headers(self):
        result = extract(statement_pdf())
        self.assertEqual(len(result["transactions"]), 5)
        self.assertEqual(result["transactions"][0]["date"], "2026-01-01")
        self.assertEqual(result["transactions"][2]["debit"], 1250.5)
        self.assertFalse(any("did not reconcile" in warning for warning in result["warnings"]))

    def test_borderless_aligned_pdf(self):
        result = extract(statement_pdf(ruled=False))
        self.assertEqual(len(result["transactions"]), 5)
        self.assertEqual(result["transactions"][0]["credit"], 50000)
        self.assertEqual(result["transactions"][1]["debit"], 12500)

    def test_money_uses_indian_grouping_and_preserves_negative_balance(self):
        self.assertEqual(money("Rs. 1,25,000.50 Cr"), Decimal("125000.50"))
        self.assertEqual(money("1,000.25 Dr"), Decimal("-1000.25"))
        self.assertEqual(money("(1,000.25)"), Decimal("-1000.25"))
        self.assertEqual(money("-"), 0)

    def test_missing_and_invalid_money_rejected(self):
        for value in ("not a number", "12.00 extra", "1.234", ""):
            with self.assertRaises(ValueError):
                money(value, allow_empty=False)

    def test_day_first_dates_and_value_date(self):
        self.assertEqual(parse_date("03/04/2026"), "2026-04-03")
        self.assertEqual(parse_date("5 Jan 2026"), "2026-01-05")
        self.assertIsNone(parse_date("31/02/2026"))
        self.assertEqual(header_map(["Value Date", *HEADERS])["date"], 1)

    def test_partial_invalid_transaction_rejected(self):
        rows = [HEADERS, SAMPLE_PAGES[0][1], ["31/02/2026", "Home EMI", "100.00", "", "5900.00"]]
        with self.assertRaises(ValueError):
            rows_from_tables([rows])

    def test_borderless_partial_invalid_transaction_rejected(self):
        rows = [HEADERS, SAMPLE_PAGES[0][1], ["31/02/2026", "Home EMI", "100.00", "", "5900.00"]]
        with self.assertRaises(ValueError):
            extract(statement_pdf([rows], ruled=False))

    def test_negative_balance_is_not_converted_to_positive(self):
        rows, _, _ = rows_from_tables([[HEADERS, ["01/01/2026", "Debit", "150.00", "", "50.00 Dr"]]])
        self.assertEqual(rows[0]["balance"], -50)

    def test_missing_balance_and_double_amount_rejected(self):
        for row in (
            ["01/01/2026", "Payment", "150.00", "", ""],
            ["01/01/2026", "Payment", "150.00", "10.00", "50.00"],
        ):
            with self.assertRaises(ValueError):
                rows_from_tables([[HEADERS, row]])

    def test_multiline_narration_continuation(self):
        rows, _, _ = rows_from_tables([[HEADERS, ["01/01/2026", "Home", "100.00", "", "900.00"], ["", "Loan EMI", "", "", ""]]])
        self.assertEqual(rows[0]["description"], "Home Loan EMI")

    def test_blank_scanned_pdf_rejected(self):
        with self.assertRaisesRegex(ValueError, "Scanned"):
            extract(statement_pdf([[]]))

    def test_unsupported_columns_rejected(self):
        with self.assertRaises(ValueError):
            extract(statement_pdf([[["Date", "Details", "Amount", "Type", "Balance"], SAMPLE_PAGES[0][1]]]))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--fixtures":
        out = Path("/tmp/bank-statement-tests")
        out.mkdir(exist_ok=True)
        (out / "synthetic-statement.pdf").write_bytes(statement_pdf())
        (out / "synthetic-borderless.pdf").write_bytes(statement_pdf(ruled=False))
        signed_headers = ["#", "Transaction Date", "Value Date", "Transaction Details", "Ref No.", "Debit/Credit", "Balance"]
        signed_rows = [signed_headers,
                       ["1", "01 Apr 2025\n01:39 PM", "01 Apr 2025", "Synthetic transfer\ncontinued narration", "TEST", "-3,500.00", "3,409.40"],
                       ["2", "03 Apr 2025\n11:45 AM", "03 Apr 2025", "Loan refund", "TEST", "+1,000.00", "4,409.40"]]
        (out / "synthetic-signed.pdf").write_bytes(statement_pdf(
            [signed_rows], xs=[19, 49, 125, 195, 335, 395, 465, 590], header_only_vertical=True))
        long_headers = ["S No.", "Transaction\nDate", "Cheque Number", "Transaction Remarks",
                        "Withdrawal\nAmount (INR)", "Deposit\nAmount (INR)", "Balance\n(INR)"]
        long_pages = [[long_headers, [str(i), "10.08.2025", "", "Synthetic payment\ncontinued narration",
                                     "1.00", "", str(1000 - i) + ".00"]] for i in range(1, 151)]
        (out / "synthetic-long.pdf").write_bytes(statement_pdf(
            long_pages, xs=[19, 49, 119, 189, 390, 456, 522, 574],
            header_only_vertical=True, header_shift=1.5, footer=True))
        (out / "synthetic-vertical.pdf").write_bytes(statement_pdf(
            [StatementTests().vertical_rows()], xs=[25, 100, 175, 330, 410, 490, 590], horizontal_rows=False))
        (out / "scanned-statement.pdf").write_bytes(statement_pdf([[]]))
        (out / "invalid.pdf").write_text("This is not a PDF")
        print(out)
    else:
        unittest.main()
