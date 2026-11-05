"""
Sample warehouse dataset — the exact business scenario from the use case.

Tables (source = target, one ontology):
  • supplier
  • product
  • sku                      (Product → SKU mapping)
  • purchase_order
  • purchase_order_line      (PurchaseOrder → Product + Quantity)
  • warehouse_location
  • stock                    (Stock → Product + Location + Condition + Quantity)
  • customer_order
  • customer_order_line
  • shipment
  • shipment_tracking        (Shipment → Tracking ID)

Each table exposes a `columns` definition and a `records` payload.
`sample_warehouse_tables()` returns both, so the demo endpoint can
register the schema AND write the rows in one call.
"""

from typing import Any, Dict, List, Tuple


SUPPLIERS = [
    {"supplier_id": "sup-001", "name": "Northwind Industrial", "country": "US", "contact_email": "orders@northwind.example"},
    {"supplier_id": "sup-002", "name": "Pacific Components", "country": "JP", "contact_email": "sales@pac-com.example"},
    {"supplier_id": "sup-003", "name": "Atlas Fasteners", "country": "DE", "contact_email": "hello@atlas-ff.example"},
]

PRODUCTS = [
    {"product_id": "prd-001", "name": "Steel Bracket 12cm", "category": "Hardware", "unit": "each"},
    {"product_id": "prd-002", "name": "Aluminum Rod 1m", "category": "Hardware", "unit": "each"},
    {"product_id": "prd-003", "name": "Rubber Gasket M8", "category": "Seals", "unit": "each"},
    {"product_id": "prd-004", "name": "Hex Bolt M8x40", "category": "Fasteners", "unit": "pack-100"},
]

SKUS = [
    {"sku_id": "sku-1001", "product_id": "prd-001", "supplier_code": "NW-BRK-12", "storefront_name": "Steel Bracket 12cm", "supplier_id": "sup-001"},
    {"sku_id": "sku-1002", "product_id": "prd-002", "supplier_code": "PC-ROD-1M", "storefront_name": "Aluminum Rod 1m", "supplier_id": "sup-002"},
    {"sku_id": "sku-1003", "product_id": "prd-003", "supplier_code": "PC-GSK-M8", "storefront_name": "Rubber Gasket M8", "supplier_id": "sup-002"},
    {"sku_id": "sku-1004", "product_id": "prd-004", "supplier_code": "AT-BLT-M8", "storefront_name": "Hex Bolt M8x40", "supplier_id": "sup-003"},
]

WAREHOUSE_LOCATIONS = [
    {"location_id": "loc-A1-01", "warehouse": "WH-WEST", "aisle": "A1", "rack": "01", "bin": "B1"},
    {"location_id": "loc-A1-02", "warehouse": "WH-WEST", "aisle": "A1", "rack": "02", "bin": "B3"},
    {"location_id": "loc-B2-01", "warehouse": "WH-EAST", "aisle": "B2", "rack": "01", "bin": "C2"},
]

PURCHASE_ORDERS = [
    {"po_id": "po-9001", "supplier_id": "sup-001", "created_at": "2026-09-10T09:00:00Z", "status": "RECEIVED"},
    {"po_id": "po-9002", "supplier_id": "sup-002", "created_at": "2026-09-15T09:30:00Z", "status": "PARTIAL"},
    {"po_id": "po-9003", "supplier_id": "sup-003", "created_at": "2026-10-01T10:00:00Z", "status": "OPEN"},
]

PURCHASE_ORDER_LINES = [
    {"line_id": "pol-01", "po_id": "po-9001", "product_id": "prd-001", "quantity": 500},
    {"line_id": "pol-02", "po_id": "po-9002", "product_id": "prd-002", "quantity": 200},
    {"line_id": "pol-03", "po_id": "po-9003", "product_id": "prd-004", "quantity": 1000},
]

STOCK = [
    {"stock_id": "stk-001", "sku_id": "sku-1001", "location_id": "loc-A1-01", "condition": "USABLE",   "usable_qty": 420, "reserved_qty": 60, "damaged_qty": 20},
    {"stock_id": "stk-002", "sku_id": "sku-1002", "location_id": "loc-A1-02", "condition": "USABLE",   "usable_qty": 180, "reserved_qty": 20, "damaged_qty": 0},
    {"stock_id": "stk-003", "sku_id": "sku-1003", "location_id": "loc-B2-01", "condition": "DAMAGED",  "usable_qty": 0,   "reserved_qty": 0,  "damaged_qty": 45},
    {"stock_id": "stk-004", "sku_id": "sku-1004", "location_id": "loc-A1-01", "condition": "USABLE",   "usable_qty": 1000, "reserved_qty": 200, "damaged_qty": 5},
]

CUSTOMER_ORDERS = [
    {"order_id": "ord-88001", "customer_name": "Apex Dynamics", "created_at": "2026-10-05T12:00:00Z", "status": "PICKING"},
    {"order_id": "ord-88002", "customer_name": "Globex Corp",   "created_at": "2026-10-06T14:30:00Z", "status": "PACKED"},
    {"order_id": "ord-88003", "customer_name": "Initech",       "created_at": "2026-10-07T08:15:00Z", "status": "SHIPPED"},
]

CUSTOMER_ORDER_LINES = [
    {"line_id": "col-01", "order_id": "ord-88001", "sku_id": "sku-1001", "quantity": 5},
    {"line_id": "col-02", "order_id": "ord-88001", "sku_id": "sku-1004", "quantity": 10},
    {"line_id": "col-03", "order_id": "ord-88002", "sku_id": "sku-1002", "quantity": 3},
]

SHIPMENTS = [
    {"shipment_id": "shp-7001", "order_id": "ord-88003", "carrier": "FastFreight", "dispatched_at": "2026-10-08T07:00:00Z", "status": "IN_TRANSIT"},
    {"shipment_id": "shp-7002", "order_id": "ord-88002", "carrier": "GlobalPost", "dispatched_at": "2026-10-09T15:00:00Z", "status": "DELIVERED"},
]

SHIPMENT_TRACKING = [
    {"tracking_id": "trk-1", "shipment_id": "shp-7001", "current_location": "WH-WEST", "last_scan_at": "2026-10-08T07:30:00Z", "status": "IN_TRANSIT"},
    {"tracking_id": "trk-2", "shipment_id": "shp-7002", "current_location": "Customer", "last_scan_at": "2026-10-09T22:00:00Z", "status": "DELIVERED"},
]


COLUMN_DEFS: Dict[str, List[Dict[str, Any]]] = {
    "supplier": [
        {"name": "supplier_id", "datatype": "string", "is_pk": True},
        {"name": "name", "datatype": "string"},
        {"name": "country", "datatype": "string"},
        {"name": "contact_email", "datatype": "string"},
    ],
    "product": [
        {"name": "product_id", "datatype": "string", "is_pk": True},
        {"name": "name", "datatype": "string"},
        {"name": "category", "datatype": "string"},
        {"name": "unit", "datatype": "string"},
    ],
    "sku": [
        {"name": "sku_id", "datatype": "string", "is_pk": True},
        {"name": "product_id", "datatype": "string", "is_fk": True},
        {"name": "supplier_code", "datatype": "string"},
        {"name": "storefront_name", "datatype": "string"},
        {"name": "supplier_id", "datatype": "string", "is_fk": True},
    ],
    "purchase_order": [
        {"name": "po_id", "datatype": "string", "is_pk": True},
        {"name": "supplier_id", "datatype": "string", "is_fk": True},
        {"name": "created_at", "datatype": "datetime"},
        {"name": "status", "datatype": "string"},
    ],
    "purchase_order_line": [
        {"name": "line_id", "datatype": "string", "is_pk": True},
        {"name": "po_id", "datatype": "string", "is_fk": True},
        {"name": "product_id", "datatype": "string", "is_fk": True},
        {"name": "quantity", "datatype": "integer"},
    ],
    "warehouse_location": [
        {"name": "location_id", "datatype": "string", "is_pk": True},
        {"name": "warehouse", "datatype": "string"},
        {"name": "aisle", "datatype": "string"},
        {"name": "rack", "datatype": "string"},
        {"name": "bin", "datatype": "string"},
    ],
    "stock": [
        {"name": "stock_id", "datatype": "string", "is_pk": True},
        {"name": "sku_id", "datatype": "string", "is_fk": True},
        {"name": "location_id", "datatype": "string", "is_fk": True},
        {"name": "condition", "datatype": "string"},
        {"name": "usable_qty", "datatype": "integer"},
        {"name": "reserved_qty", "datatype": "integer"},
        {"name": "damaged_qty", "datatype": "integer"},
    ],
    "customer_order": [
        {"name": "order_id", "datatype": "string", "is_pk": True},
        {"name": "customer_name", "datatype": "string"},
        {"name": "created_at", "datatype": "datetime"},
        {"name": "status", "datatype": "string"},
    ],
    "customer_order_line": [
        {"name": "line_id", "datatype": "string", "is_pk": True},
        {"name": "order_id", "datatype": "string", "is_fk": True},
        {"name": "sku_id", "datatype": "string", "is_fk": True},
        {"name": "quantity", "datatype": "integer"},
    ],
    "shipment": [
        {"name": "shipment_id", "datatype": "string", "is_pk": True},
        {"name": "order_id", "datatype": "string", "is_fk": True},
        {"name": "carrier", "datatype": "string"},
        {"name": "dispatched_at", "datatype": "datetime"},
        {"name": "status", "datatype": "string"},
    ],
    "shipment_tracking": [
        {"name": "tracking_id", "datatype": "string", "is_pk": True},
        {"name": "shipment_id", "datatype": "string", "is_fk": True},
        {"name": "current_location", "datatype": "string"},
        {"name": "last_scan_at", "datatype": "datetime"},
        {"name": "status", "datatype": "string"},
    ],
}

RECORDS: Dict[str, List[Dict[str, Any]]] = {
    "supplier": SUPPLIERS,
    "product": PRODUCTS,
    "sku": SKUS,
    "purchase_order": PURCHASE_ORDERS,
    "purchase_order_line": PURCHASE_ORDER_LINES,
    "warehouse_location": WAREHOUSE_LOCATIONS,
    "stock": STOCK,
    "customer_order": CUSTOMER_ORDERS,
    "customer_order_line": CUSTOMER_ORDER_LINES,
    "shipment": SHIPMENTS,
    "shipment_tracking": SHIPMENT_TRACKING,
}


def sample_warehouse_tables() -> List[Dict[str, Any]]:
    """List of {name, columns, records} for every table."""
    return [
        {
            "name": name,
            "columns": COLUMN_DEFS[name],
            "records": RECORDS[name],
        }
        for name in COLUMN_DEFS.keys()
    ]


def table_summary() -> Dict[str, int]:
    """{table_name: row_count} for a compact response."""
    return {name: len(rows) for name, rows in RECORDS.items()}