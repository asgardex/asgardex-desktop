# Remaining issues — `chore/lastblock-poll-60s`

Branch: `chore/lastblock-poll-60s`  
Review date: 2026-08-04

## Status after follow-up fixes

| #   | Issue                                     | Status                                                                                            |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | App THORNode REST multi-URL fallback      | **Fixed** — `getThornodeApiBaseUrls` + `requestThornodeApiBases` used by `createThornodeService$` |
| 2   | `getChainId` single-URL at client create  | **Fixed** — multi-base walk in `thorchain/common.ts` (+ keystore catchError)                      |
| 3   | Maya Asset Details `getActions` arg order | **Fixed** — protocol-branched call in `midgardHistory.ts`                                         |

No open items from this review.
