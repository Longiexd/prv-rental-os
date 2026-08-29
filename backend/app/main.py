from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.odoo_client import odoo

from app.routes import (
    cars,
    customers,
    leads,
    crm,
    sales,
    invoices,
    customer_create,
)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="Klynx Rental OS API",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "https://rental-os.klynx.net",
        "http://localhost:3100",
    ],

    allow_credentials=True,

    allow_methods=[
        "*",
    ],

    allow_headers=[
        "*",
    ],
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "status": "Rental OS API",
    }


# ============================================================
# TEST LOGIN
# ============================================================

@app.get("/login")
def login():
    return {
        "uid": odoo.authenticate(),
    }


# ============================================================
# ROUTES
# ============================================================

app.include_router(
    cars.router
)

app.include_router(
    customers.router
)

app.include_router(
    customer_create.router
)

app.include_router(
    leads.router
)

app.include_router(
    crm.router
)

app.include_router(
    sales.router
)

app.include_router(
    invoices.router
)