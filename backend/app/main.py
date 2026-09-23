from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_cors_allowed_origins
from app.odoo_client import odoo
from app.routes import activities, analytics, booking_changes, calendar, cars, crm, customers, invoices, leads, rentals, sales

app = FastAPI(
    title="Klynx Rental OS API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "Rental OS API"}


@app.get("/login")
def login():
    return {"uid": odoo.authenticate()}


app.include_router(cars.router)
app.include_router(customers.router)
app.include_router(leads.router)
app.include_router(crm.router)
app.include_router(sales.router)
app.include_router(invoices.router)
app.include_router(rentals.router)
app.include_router(calendar.router)
app.include_router(analytics.router)
app.include_router(activities.router)
app.include_router(booking_changes.router)
