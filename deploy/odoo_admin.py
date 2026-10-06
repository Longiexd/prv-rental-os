"""Executed through Odoo shell over stdin by the private host administrator.

This file is not an HTTP controller and is never installed as an Odoo addon.
"""
import json
import secrets


def run(env, operation, data):
    company = env.ref("base.main_company")
    users = env["res.users"].with_context(active_test=False, no_reset_password=True)
    if operation == "configure":
        country = env["res.country"].search([("code", "=", data["country"])], limit=1)
        currency = env["res.currency"].with_context(active_test=False).search([("name", "=", data["currency"])], limit=1)
        if not country or not currency:
            raise ValueError("Unknown country or currency")
        currency.active = True
        company.write({"name": data["name"], "country_id": country.id, "currency_id": currency.id})
        # Accounting localization and chart setup are completed later in Odoo.
        # Ignore legacy manifests' chart field when resuming provisioning.
        # Close standard administrator credentials. Only the host's Odoo shell administers accounts.
        for xmlid in ("base.user_admin", "base.user_root"):
            user = env.ref(xmlid)
            user.write({"password": secrets.token_urlsafe(48)})
        env.ref("base.user_admin").active = False
        env["ir.config_parameter"].set_param("auth_signup.invitation_scope", "b2b")
        for name in ("Disponible", "Réservé", "Loué", "Retour dû"):
            if not env["fleet.vehicle.state"].search_count([("name", "=", name)]):
                env["fleet.vehicle.state"].create({"name": name})
        result = {"configured": True}
    elif operation == "add-user":
        groups = [env.ref(xmlid).id for xmlid in (
            "base.group_user", "sales_team.group_sale_salesman_all_leads",
            "fleet.fleet_group_manager", "account.group_account_invoice",
        )]
        user = users.search([("login", "=", data["login"])], limit=1)
        values = {"name": data["name"], "login": data["login"], "password": data["password"], "active": True,
                  "company_id": company.id, "company_ids": [(6, 0, [company.id])], "groups_id": [(6, 0, groups)]}
        if user:
            if user.has_group("base.group_system") or user.has_group("base.group_erp_manager") or user.share:
                raise ValueError("Refusing to enroll an existing privileged or external account")
            user.write(values)  # Resume an interrupted, still inactive Klynx registration.
        else:
            user = users.create(values)
        if user.has_group("base.group_system") or user.has_group("base.group_erp_manager"):
            raise ValueError("Customer must not receive administrative permissions")
        result = {"uid": user.id}
    elif operation in {"reset-user", "disable-user", "enable-user"}:
        user = users.browse(data["uid"]).exists()
        if not user or user.login != data["login"] or user.id in (env.ref("base.user_admin").id, env.ref("base.user_root").id):
            raise ValueError("User identity does not match the registry")
        values = {"password": data["password"]} if operation == "reset-user" else {"active": operation == "enable-user"}
        user.write(values)
        result = {"uid": user.id}
    elif operation == "check":
        assert not env.ref("base.user_admin").active
        for user in users.search([("active", "=", True), ("share", "=", False)]):
            if user.id != env.ref("base.user_root").id:
                assert not user.has_group("base.group_system") and not user.has_group("base.group_erp_manager")
        result = {"configured": True, "company": company.name}
    else:
        raise ValueError("Unsupported operation")
    env.cr.commit()
    print("KLYNX_RESULT=" + json.dumps(result))
