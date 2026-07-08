"""Iteration 14: Siyaram multi-page PO extraction regression.

Siyaram POs span multiple pages without repeating the table header row, and
page 3 of the sample has no extractable table at all. The fix adds a
text-block parser (`_siyaram_text_block_parse`) that walks the entire text
stream and pairs each numeric row with its description / material code /
HSN by scanning neighbouring lines. This test pins the expected output for
the sample PO so the behaviour doesn't regress.
"""
from __future__ import annotations

import os
import pytest

from po_extractor_free import extract_po_from_pdf_local, _split_color_size_from_desc

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "siyaram_2220008835.pdf")


@pytest.fixture(scope="module")
def siyaram():
    if not os.path.exists(FIXTURE):
        pytest.skip("Siyaram fixture missing")
    with open(FIXTURE, "rb") as fh:
        return extract_po_from_pdf_local(fh.read())


class TestSiyaramMeta:
    def test_po_number(self, siyaram):
        assert siyaram["po_number"] == "2220008835"

    def test_po_date(self, siyaram):
        assert siyaram["po_date"] == "2026-05-21"

    def test_client_name(self, siyaram):
        assert siyaram["client_name"] == "SIYARAM SILK MILLS LTD."

    def test_vendor_name(self, siyaram):
        # Must NOT pick up the address fragment that follows ``Vendor Code:``
        assert siyaram["vendor_name"] == "SSK FOOTCARE MANUFACTURING LLP"

    def test_currency(self, siyaram):
        assert siyaram["currency"] == "INR"


class TestSiyaramLineItems:
    def test_total_count(self, siyaram):
        """All 32 line items must be parsed (was 10 before the fix)."""
        assert len(siyaram["line_items"]) == 32

    def test_total_quantity(self, siyaram):
        assert sum(li["quantity"] for li in siyaram["line_items"]) == 2088
        assert siyaram["total_quantity"] == 2088

    def test_grand_total(self, siyaram):
        assert siyaram["grand_total"] == 333440.0

    def test_every_item_has_qty_rate(self, siyaram):
        for li in siyaram["line_items"]:
            assert li["quantity"] > 0
            assert li["unit_price"] > 0
            assert li["amount"] > 0

    def test_every_item_has_color_size(self, siyaram):
        """Color/Size must be extracted from space-separated description."""
        for li in siyaram["line_items"]:
            assert li["color"], f"missing color for {li}"
            assert li["size"], f"missing size for {li}"

    def test_every_item_has_style_code(self, siyaram):
        """Material chunks (5ZEZP125WW + FLT11719888) must be joined."""
        for li in siyaram["line_items"]:
            assert li["style_code"], f"missing style_code for {li}"
            # Material code is alphanumeric, length 10..25
            assert 10 <= len(li["style_code"]) <= 25

    def test_first_item(self, siyaram):
        first = siyaram["line_items"][0]
        assert first["quantity"] == 72
        assert first["unit_price"] == 160.0
        assert first["amount"] == 11520.0
        assert first["color"] == "BROWN"
        assert first["size"] == "4"
        assert first["style_code"] == "5ZEZP125WWFLT11719888"

    def test_last_item(self, siyaram):
        last = siyaram["line_items"][-1]
        assert last["quantity"] == 64
        assert last["unit_price"] == 155.0
        assert last["amount"] == 9920.0
        assert last["color"] == "CREAM"
        assert last["size"] == "9"
        assert last["style_code"] == "5ZEZFLWWWFLTM7128465"


class TestSplitColorSize:
    def test_comma_separated_still_works(self):
        """SHEIN-style comma-separated must continue working unchanged."""
        assert _split_color_size_from_desc("SHEINWOMENBLOUSE,BLACK,3") == (
            "SHEINWOMENBLOUSE", "BLACK", "3",
        )
        assert _split_color_size_from_desc("STYLE001,RED") == ("STYLE001", "RED", "")

    def test_space_separated_siyaram(self):
        assert _split_color_size_from_desc("ZP125WWFLT117 BROWN 4") == (
            "ZP125WWFLT117", "BROWN", "4",
        )
        assert _split_color_size_from_desc("ZFLWWWFLTM71 CREAM 9") == (
            "ZFLWWWFLTM71", "CREAM", "9",
        )

    def test_half_size(self):
        assert _split_color_size_from_desc("ZP125WWFLT104 TAN 7.5") == (
            "ZP125WWFLT104", "TAN", "7.5",
        )

    def test_no_structure(self):
        assert _split_color_size_from_desc("") == ("", "", "")
        d, c, s = _split_color_size_from_desc("JUST PLAIN TEXT")
        assert s == ""
