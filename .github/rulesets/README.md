# Default branch protection

`protected.json` is the importable definition of the live `protected` ruleset, based on
`carere/zaidan`. It prevents deletion and force-pushes, requires squash pull requests with resolved
discussions, and requires the branch to be up to date with a passing GitHub Actions `Checks` job.
There are no bypass actors or required approving reviews.

The required check is adapted to this repository. Cloudflare build checks are not required because
they are not currently reported on its pull requests.

GitHub does not apply this file automatically. Import it under **Settings → Rules → Rulesets**, or
apply it using the GitHub API. When updating an existing ruleset, use its ID:

```sh
gh api --method PUT repos/carere/remoshu/rulesets/RULESET_ID \
  --input .github/rulesets/protected.json
```

Repository settings also enable auto-merge and allow squash merges only.
