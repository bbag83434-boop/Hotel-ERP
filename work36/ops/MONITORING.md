# Part 35 Monitoring

## Health endpoint
`GET /api/v1/health` reports application uptime, process memory, and database connectivity/latency.

## Operational alerts
Configure the deployment/monitoring platform to alert on:
- health endpoint unavailable for 2 consecutive checks
- HTTP 5xx rate above the agreed threshold
- database check failures or sustained latency
- backup job failure
- no successful backup within the defined RPO window
- repeated Telegram/WhatsApp delivery failures

## Recovery objective
Set an explicit business RPO/RTO before production launch. Do not claim a recovery guarantee until a real restore drill has passed on a non-production database.
