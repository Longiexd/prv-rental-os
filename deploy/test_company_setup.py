import ast
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import runpy
import secrets
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[1]
run = runpy.run_path(str(ROOT / 'deploy/odoo_admin.py'))['run']

class CompanySetupTests(unittest.TestCase):
    def environment(self):
        company = SimpleNamespace(write=MagicMock(), name='King Rent Car')
        country = MagicMock(id=216)
        currency = MagicMock(id=42)
        users = MagicMock()
        users.search.return_value = []
        models = {name: MagicMock() for name in ('res.country', 'res.currency', 'res.users', 'ir.config_parameter', 'fleet.vehicle.state')}
        models['res.country'].search.return_value = country
        models['res.currency'].with_context.return_value.search.return_value = currency
        models['res.users'].with_context.return_value = users
        refs = {'base.main_company': company, 'base.user_admin': MagicMock(active=False), 'base.user_root': MagicMock(id=1)}
        env = MagicMock()
        env.__getitem__.side_effect = models.__getitem__
        env.ref.side_effect = refs.__getitem__
        return env, company

    def test_configure_without_accounting_template(self):
        env, company = self.environment()
        with redirect_stdout(io.StringIO()):
            run(env, 'configure', {'name': 'King Rent Car', 'country': 'TN', 'currency': 'TND'})
        company.write.assert_called_once_with({'name': 'King Rent Car', 'country_id': 216, 'currency_id': 42})
        env.cr.commit.assert_called_once()

    def test_resume_ignores_legacy_chart(self):
        env, company = self.environment()
        with redirect_stdout(io.StringIO()):
            run(env, 'configure', {'name': 'King Rent Car', 'country': 'TN', 'currency': 'TND', 'chart': 'tn'})
        company.write.assert_called_once()

    def test_check_accepts_company_without_chart(self):
        env, _ = self.environment()
        with redirect_stdout(io.StringIO()) as output:
            run(env, 'check', {})
        self.assertIn('"configured": true', output.getvalue())

    def test_manifest_has_only_basic_company_fields(self):
        tree = ast.parse((ROOT / 'deploy/admin.py').read_text())
        cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Admin')
        method = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == 'add_company')
        namespace = {'names': lambda env, code: ('project', 'host', 'db'), 'json': json, 'secrets': secrets,
                     'compose_document': lambda *args: {}, 'database_bootstrap': lambda *args: '',
                     'write_new': lambda path, text, *args: path.write_text(text)}
        exec(compile(ast.Module(body=[method], type_ignores=[]), '<add_company>', 'exec'), namespace)
        control = MagicMock()
        control.db.return_value.__enter__.return_value.execute.return_value.fetchone.return_value = None
        with tempfile.TemporaryDirectory(dir=ROOT) as tmp:
            root = Path(tmp)
            (root / 'images.json').write_text('{"odoo":"odoo-image","postgres":"postgres-image"}')
            admin = SimpleNamespace(environment='production', root=root, control=lambda: control,
                                    directory=lambda code: root / 'companies' / code, resume_company=MagicMock())
            namespace['add_company'](admin, 'kng', 'King Rent Car', 'TN', 'TND')
            manifest = json.loads((root / 'companies/kng/company.json').read_text())
            self.assertEqual(manifest, {'code':'kng', 'name':'King Rent Car', 'country':'TN', 'currency':'TND'})
            admin.resume_company.assert_called_once_with('kng')
            with self.assertRaises(ValueError):
                namespace['add_company'](admin, 'bad', 'Name', '', 'TND')

if __name__ == '__main__':
    unittest.main()
