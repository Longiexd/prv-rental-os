"""Executed through Odoo shell over stdin by the private host administrator.

This file is not an HTTP controller and is never installed as an Odoo addon.
"""
import json
import secrets


def bootstrap_admin(env):
    parameters = env["ir.config_parameter"].sudo()
    if parameters.get_param("klynx.admin_bootstrapped") == "1":
        return
    administrator = env.ref("base.user_admin")
    other = env["res.users"].with_context(active_test=False).search([
        ("login", "=", "admin"), ("id", "!=", administrator.id),
    ], limit=1)
    if other:
        raise ValueError("Admin login is already assigned to another account")
    administrator.with_context(no_reset_password=True).write({
        "login": "admin", "password": "admin", "active": True,
        "groups_id": [(4, env.ref("base.group_system").id),
                      (4, env.ref("base.group_erp_manager").id),
                      (4, env.ref("account.group_account_manager").id)],
    })
    parameters.set_param("klynx.admin_bootstrapped", "1")


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
        # Bootstrap only once so provisioning retries preserve changed credentials.
        bootstrap_admin(env)
        env.ref("base.user_root").write({"password": secrets.token_urlsafe(48)})
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
    elif operation == "bootstrap-admin":
        bootstrap_admin(env)
        result = {"configured": True}
    elif operation == "check":
        for user in users.search([("active", "=", True), ("share", "=", False)]):
            owner_id = int(env["ir.config_parameter"].sudo().get_param("klynx.owner_user_id", "0"))
            if user.id == owner_id:
                assert user.login == "klynx-owner"
                continue
            if user.id not in {env.ref("base.user_root").id, env.ref("base.user_admin").id}:
                assert not user.has_group("base.group_system") and not user.has_group("base.group_erp_manager")
        result = {"configured": True, "company": company.name}
    else:
        raise ValueError("Unsupported operation")
    env.cr.commit()
    print("KLYNX_RESULT=" + json.dumps(result))
