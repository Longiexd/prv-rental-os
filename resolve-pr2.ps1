param(
  [Parameter(Mandatory = $true)]
  [string]$RepositoryPath
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path -LiteralPath $RepositoryPath).Path
$bundle = Join-Path $PSScriptRoot "klynx-pr2-merge-resolution.bundle"

if (-not (Test-Path -LiteralPath (Join-Path $repo ".git"))) {
  throw "RepositoryPath must point to your prv-rental-os checkout."
}
if (-not (Test-Path -LiteralPath $bundle)) {
  throw "The merge bundle is missing. Extract the complete ZIP before running this script."
}
if ((git -C $repo status --porcelain)) {
  throw "Your checkout has uncommitted work. Commit or stash it before resolving the pull request."
}
if ((git -C $repo branch --show-current).Trim() -ne "new-features") {
  throw "Switch to the new-features branch before running this script."
}

git -C $repo fetch $bundle new-features-staging-resolved
git -C $repo merge --ff-only FETCH_HEAD
git -C $repo push origin new-features

Write-Host "PR #2 resolution pushed. Refresh GitHub and wait for its checks."
