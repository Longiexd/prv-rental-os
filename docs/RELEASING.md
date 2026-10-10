# Versions and LTS

`VERSION` identifies the candidate being prepared. Git tags identify published
releases, and deployment records keep their exact commit SHA as today.
Use descriptive commit messages; one commit does not automatically mean a release.

1. Develop and test on `staging`. Record the candidate's changes in `CHANGELOG.md`.
2. Require backend/frontend tests, native Odoo integration and staging deployment
   to pass. Check login/logout, a rental, optional driver paperwork, vehicle alert
   links, renewal filters, service completion and both languages/themes in staging.
3. For the first stable release, change `VERSION` to `1.0.0`, update the changelog,
   and test that exact commit on staging before promoting through the existing
   `main` workflow. Production must still promote a successfully staged SHA.
4. After production verification, create an annotated `v1.0.0` tag on the actual
   deployed commit and a GitHub release describing changes and known limitations.
   Do not tag a failed deployment or assume the merge commit is the deployed SHA.

Use `1.0.1` for backward-compatible fixes, `1.1.0` for backward-compatible features,
and `2.0.0` for incompatible changes. Update `VERSION`, the package manifest version
and lockfile version together when publishing a release; dependency versions stay
unchanged. Release candidates use `-rc.N` and remain outside the stable LTS line.

## LTS designation

The `1.0.x` line can be designated **1.0 LTS** once the above checks pass and a
support owner and support end date are written in its published release notes.
LTS updates contain security, correctness and compatibility fixes. Fleet features
and future bookings/fleet/management module separation belong to later minor
releases. Each LTS fix still goes through staging and tenant isolation checks.
An LTS label alone does not promise automatic maintenance or a support duration.

## Pipeline cleanup

`tenant-integration.yml` remains the shared Odoo separation check. CI invokes it
on pull requests; staging deployment invokes it before deployment. Its redundant
standalone PR trigger is removed. Containers exist only in the disposable GitHub
runner. Production approval, environment secrets, SHA checks and installation
scripts are unchanged. Old workflow runs are historical evidence, not duplicate
live infrastructure, and do not need deleting.

At this audit, GitHub reports `main` and `staging` as unprotected. Before publishing
LTS, require review and the CI checks on `main` (including the tenant isolation job)
in repository settings. This update does not change those account settings.
