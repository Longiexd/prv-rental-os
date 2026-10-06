# Klynx Rental OS

Deployment and environment setup is documented in
[`docs/staging-production-infrastructure.md`](docs/staging-production-infrastructure.md).

Company creation and worker credentials are managed only by Klynx using the
[private Compose administration menu](deploy/MULTITENANCY.md). Each company has
its own Odoo/PostgreSQL stack. Users sign in with a company-qualified username
and password; customers cannot create accounts or administer the platform.

The release model is one codebase and one tested commit, promoted from
`staging` to protected `main`; only environment variables, secrets, Odoo
connections, and named Cloudflare Worker environments differ.

Internal development documentation for Klynx Rental OS.

A modular SaaS platform for rental businesses built as the first product of the Klynx ecosystem.

The goal is to create a reusable business operating system that can later adapt to different industries:

- Car Rental OS
- Real Estate OS
- Retail OS
- Clinic OS
- Workshop OS
- Other vertical SaaS solutions

---

# Vision

Klynx Rental OS replaces complex ERP interfaces with a modern, simple operational dashboard.

The system separates:

## Odoo
Backend ERP engine:

- Database
- Business logic
- Accounting
- Fleet management
- CRM
- Contacts

## Rental OS
Modern frontend experience:

- Dashboard
- Reservations
- Customer management
- CRM pipeline
- Fleet interface
- Business analytics

---

# Architecture

                USER

                  |

          rental-os.klynx.net

                  |

            Next.js Frontend

                  |

            FastAPI Backend

                  |

          Odoo JSON-RPC API

                  |

           PostgreSQL Database

---

# Infrastructure

Current deployment:
Docker

|
|
├── Next.js Frontend
|
├── FastAPI Backend
|
├── Nginx Reverse Proxy
|
└── Odoo ERP

All services communicate through Docker networks.

---

# Tech Stack

## Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Radix UI
- Lucide Icons

Design inspiration:

- Linear
- Vercel Dashboard
- Stripe
- Raycast
- Notion

---

## Backend

- FastAPI
- Python
- Odoo JSON-RPC integration

Backend responsibilities:

- Authentication
- API abstraction
- Data transformation
- Business logic

---

## ERP

Odoo Community

Used modules:

- Fleet
- CRM
- Contacts
- Accounting

---

# Frontend Structure

├── app/
│
│ ├── dashboard/
│ ├── fleet/
│ ├── customers/
│ ├── crm/
│ ├── calendar/
│ └── reservations/
│
├── components/
│
│ ├── layout/
│ │ ├── sidebar.tsx
│ │ ├── topbar.tsx
│ │ └── app-shell.tsx
│ │
│ ├── dashboard/
│ │
│ ├── fleet/
│ │
│ └── ui/
│
├── lib/
│
└── styles/

---

# Backend Structure

backend/

└── app/

├── main.py

├── config.py

├── odoo_client.py

└── routes/

    ├── cars.py

    ├── customers.py

    └── leads.py

---

# API

Current endpoints:


GET /

GET /cars

GET /customers

GET /leads

GET /login


Data flow:


Frontend

↓

FastAPI

↓

Odoo JSON-RPC

↓

Odoo Database


---

# Development

Everything runs through Docker.

## Start services


docker compose up -d


---

## Rebuild frontend


docker compose build frontend

docker compose up -d


---

## View logs

Frontend:


docker logs -f klynx-rental-frontend


Backend:


docker logs -f klynx-rental-api


---

## Enter frontend container


docker exec -it klynx-rental-frontend sh


Install packages inside container:


npm install package-name


---

# Design System

Klynx uses a dark professional SaaS interface.

## Colors

Background:


#09090B


Cards:


#111113


Secondary cards:


#17171A


Borders:


#2B2B30


Text:


#FFFFFF


Muted:


#71717A


---

## Accent Colors

Green:


#C8F065


Used for:

- Active states
- Success
- Primary actions


Pink:


#F06AAA


Used for:

- Highlights
- Notifications
- AI features

---

# User Roles

## Rental Agent

Daily operations:

Can access:

- Customers
- Reservations
- CRM
- Vehicle availability


---

## Fleet Manager

Technical operations:

Can access:

- Maintenance
- Insurance
- Mileage
- Repairs
- Compliance


---

## Owner/Admin

Full access:

- Revenue
- Costs
- Analytics
- Users
- Settings

---

# Development Roadmap

## Phase 1 — Foundation

Current phase.

- Docker setup
- Next.js setup
- Theme
- shadcn/ui
- App shell
- Navigation


## Phase 2 — Dashboard

- KPI cards
- Revenue overview
- Rental activity
- Fleet summary


## Phase 3 — Fleet

- Vehicle table
- Vehicle profiles
- Availability
- Maintenance


## Phase 4 — CRM

- Kanban pipeline
- Leads
- Customer communication


## Phase 5 — Reservations

- Calendar
- Booking workflow
- Vehicle assignment


## Phase 6 — SaaS Features

- Authentication
- Multi-company support
- Permissions
- Billing

---

# Git Workflow

Main branch:


main


Before major changes:
git add .
git add .

git commit -m "description"


Examples:


Initial architecture

Add frontend shell

Connect cars API

Add dashboard components


---

# Future Goal

Rental OS should become a reusable Klynx platform.

The same foundation should allow creating:


Klynx Rental OS

    ↓

Klynx Clinic OS

    ↓

Klynx Retail OS

    ↓

Klynx Workshop OS


with shared:

- Authentication
- Design system
- API layer
- Infrastructure
- Deployment pipeline

Then:

git add README.md
git commit -m "Add internal project documentation"

This README will become your source of truth while building. Later, before showing it publicly, we remove internal details (server structure, roles, unfinished roadmap) and turn it into a portfolio case study.
