import io
import runpy
import unittest
from contextlib import redirect_stdout
from unittest.mock import MagicMock
from pathlib import Path

module = runpy.run_path(str(Path(__file__).parent / "deploy/odoo_admin.py"))

class BootstrapTests(unittest.TestCase):
    def environment(self, initialized=False):
        params = MagicMock()
        params.get_param.side_effect = lambda key, default=None: ("1" if initialized else None) if key == "klynx.admin_bootstrapped" else "0"
        params.sudo.return_value = params
        admin = MagicMock(id=2)
        root = MagicMock(id=1)
        users = MagicMock()
        users.with_context.return_value = users
        users.search.return_value = False
        env = MagicMock()
        models = {"ir.config_parameter": params, "res.users": users}
        env.__getitem__.side_effect = models.__getitem__
        refs = {"base.user_admin": admin, "base.user_root": root, "base.main_company": MagicMock(name="company")}
        for name in ["base.group_system", "base.group_erp_manager", "account.group_account_manager"]:
            refs[name] = MagicMock(id=len(refs)+1)
        refs["base.main_company"].name = "King Rent Car"
        env.ref.side_effect = refs.__getitem__
        return env, params, admin, users

    def test_initial_credentials_and_marker(self):
        env, params, admin, _ = self.environment()
        module["bootstrap_admin"](env)
        values = admin.with_context.return_value.write.call_args.args[0]
        self.assertEqual((values["login"],values["password"],values["active"]), ("admin","admin",True))
        params.set_param.assert_called_once_with("klynx.admin_bootstrapped", "1")

    def test_retry_preserves_changed_password_and_login(self):
        env, params, admin, _ = self.environment(True)
        module["bootstrap_admin"](env)
        admin.with_context.assert_not_called()
        params.set_param.assert_not_called()

    def test_collision_refused_without_reset(self):
        env, params, admin, users = self.environment()
        users.search.return_value = MagicMock()
        with self.assertRaises(ValueError): module["bootstrap_admin"](env)
        admin.with_context.assert_not_called()
        params.set_param.assert_not_called()

    def test_check_allows_builtin_admin(self):
        env, _, admin, users = self.environment(True)
        users.search.return_value = [admin]
        with redirect_stdout(io.StringIO()): module["run"](env,"check",{})
        env.cr.commit.assert_called_once()

    def test_check_rejects_privileged_customer(self):
        env, _, _, users = self.environment(True)
        customer=MagicMock(id=99)
        customer.has_group.return_value=True
        users.search.return_value=[customer]
        with self.assertRaises(AssertionError): module["run"](env,"check",{})
        env.cr.commit.assert_not_called()

if __name__ == "__main__": unittest.main()
