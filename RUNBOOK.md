# Runbook

## Rollback

This tool runs on Vercel. Steps from Vercel's own pages, read on 2026-11-09:
[Instant Rollback](https://vercel.com/docs/instant-rollback),
[Promoting a deployment](https://vercel.com/docs/deployments/promoting-a-deployment) and
[System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).

**Deploy.** Merge to `main`. Vercel builds production from that commit; nothing is copied by
hand. CI has already run the checks on the pull request.

**Back.** On the project's overview page, on the Production Deployment tile, click
**Instant Rollback**, choose the previous deployment, check the domains it lists, and click
**Confirm Rollback**. On the Hobby plan only the immediately previous production deployment
can be chosen. Environment variables are not rolled back: the old build runs with today's.

**Forward.** After a rollback Vercel turns off auto-assignment of production domains, so a
new push to `main` does not go live by itself. To undo it, click **Manage** on the
Production Deployment tile, choose the newer deployment and click **Confirm**, or run
`vercel promote <deployment-url>`. Then push a small change and check that it goes live.

**Which commit is live.** `curl -s https://<your-host>/api/health` and compare `commit` with
`git rev-parse --short=7 HEAD`. Vercel sets `VERCEL_GIT_COMMIT_SHA` at build and run time;
anywhere else the answer says `local`.

**Times.** Not taken yet: this copy has no deployment. Write them on the day you rehearse.

```
Times     ____-__-__   deploy _:__   back _:__   forward _:__
```
