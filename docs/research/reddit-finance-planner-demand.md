# What Reddit wants from a personal finance planner

**Date:** 2026-08-24
**Method:** Primary-source research on Reddit. Threads pulled live (search + top comments via Reddit's JSON API through a logged-in browser session) from r/ynab, r/mintuit, r/MonarchMoney, r/personalfinance, r/copilotmoney, r/selfhosted. Ranked by upvote weight and how often the same demand recurs across independent threads. Scores are thread/comment upvotes at fetch time.

---

## 1. Ranked feature demand

| # | Demand | Evidence strength | Summary |
|---|--------|-------------------|---------|
| 1 | **Fair pricing (tiers, one-time, cheap manual mode)** | Very high — multiple 300–950pt threads | The single loudest theme. Users repeatedly ask for a cheaper tier without bank sync, one-time purchase, or regional pricing. "I really dislike the fact that ynab went from a proper software package which you bought and paid for to a subscription model" (339 upvotes). |
| 2 | **Reliable bank sync — or honest manual/CSV workflow instead** | Very high | Sync breakage is the #1 stated reason to leave an app. r/MonarchMoney has a steady drumbeat of per-bank connection-failure threads. On Monarch's investment sync: "It is 100% the biggest problem and it is the upgrade I would immediately leave for if a competitor had it" (70 upvotes). Conversely, a large cohort explicitly does NOT want sync ("no desire to ever sync any software with my bank accounts"). |
| 3 | **CSV/statement upload + auto-categorization (no sync needed)** | High — a 341pt thread is literally this ask | "I just need the ability to upload a spreadsheet I download from my bank every month... and have it auto categorize the transactions and help me budget. Simple needs." |
| 4 | **Recurring bills / subscription tracking with a calendar view** | High | Top comment (124 upvotes) in the r/ynab wishlist thread: "Calendar view for the month seeing all scheduled transactions." Monarch's recurring feature drew a 192pt thread titled "Recurring feature is useless?" — users want per-transaction (not per-merchant) recurrence and accurate upcoming-bill prediction. |
| 5 | **Shared / partner / household budgeting** | High | "Collab with SO is an underrated ask. We've been saying for years we wish we could combine our mint accounts" (r/mintuit). YNAB users running "a three-budget house (mine, his, ours)" want transfers between budgets; family-tier pricing is a recurring ask. |
| 6 | **Investments & net worth tracking** | High | Monarch's weak investment view is called "the biggest problem"; many keep a second app (Empower) just for holdings. Mint-refugee poll voters picked apps partly on net-worth features. |
| 7 | **Cash-flow view & forecasting in the core product** | Medium-high | "Forecasting should be included in core" (Monarch Plus backlash). YNAB users want a Cash Flow page: "YNAB's Income VS Expense chart doesn't account for savings and investment budget." Also "below the line" items that appear in cash flow but not the monthly budget. |
| 8 | **Multi-currency & non-US bank support** | Medium-high | "Multiple currencies for when I'm traveling" (19 upvotes); European/Canadian/Mexican users can't use direct import at all and resent paying full price for it (the core of the 338pt tiered-pricing thread). |
| 9 | **Transaction UX polish: undo, splits, sort, nested categories** | Medium-high | "An UNDO button on the app.... PLEASE" (90 upvotes). Splits called out explicitly in the Mint-alternatives comparison thread ("add a row for the ability to split transactions... Target: grocery, home goods, clothing"). Manual reorder of same-day transactions (60), custom account grouping (47), nested categories (20), budget by category group (14). |
| 10 | **Flexible targets/goals** | Medium | Percent-of-income goals ("save 15% of all ready-to-budget", 20 upvotes), targets with caps ("put X every month with a cap of Y", 64), debt avalanche/snowball planning (12). |
| 11 | **Receipt capture / OCR** | Medium | "Receipt image storage. Bonus if it can OCR the receipt to enter the transaction" (r/ynab). Monarch shipping receipt scanning drew a 322pt celebration thread. |
| 12 | **Data export / no lock-in** | Medium | Post-Mint trauma: users audit apps for a "data export" capability before committing (comparison-chart thread). Migration fatigue: "I only want to do this migration once." |
| 13 | **Self-hosted / open source / local-first** | Medium (intense niche) | "Actual Budget going open source" (616pts, r/selfhosted); Actual appreciation post (290pts). Firefly III alternatives sought because options are "either ugly, a huge workflow change, [or] abandoned." |

## 2. Deal-breakers and rage points

1. **Price hikes without new value.** YNAB's increase produced a 943pt thread dissecting the botched rollout ("this was clumsy") and a wave of cancellations. "YNAB4 still works — which to me is a testament to how bloated nYNAB became to justify the subscription cost" (39). Recurring verdict: "For a personal finance app to cost what I used to spend on a month of groceries doesn't seem right" (20). ([price-hike thread](https://www.reddit.com/r/ynab/comments/ql77om/), [Leaving YNAB](https://www.reddit.com/r/ynab/comments/1ijv9ve/), [tiered pricing](https://www.reddit.com/r/ynab/comments/104n4n4/))
2. **Paywalling features users consider core.** Monarch's "Plus" tier triggered a 790pt response and a partial walk-back; even after concessions: "I still think forecasting should be included in core." ([Monarch Plus update](https://www.reddit.com/r/MonarchMoney/comments/1stvnik/))
3. **Sync breakage.** Named as an immediate churn trigger; r/MonarchMoney's front page is regularly bank-connection complaints (Capital One, TD Canada, credit unions). ([investment letdown](https://www.reddit.com/r/MonarchMoney/comments/1lr876o/), [TD Canada](https://www.reddit.com/r/MonarchMoney/comments/1t1nvhi/))
4. **Ads, upsells, and data selling.** Mint's decay arc: "they have begun integrating ads into every aspect of their platform" (462pts); "Mint gives your data away" in a thread title; Credit Karma as forced replacement: "Wow, I can't believe how much Credit Karma sucks" (336pts). ([ads](https://www.reddit.com/r/personalfinance/comments/a7ymm8/), [CK](https://www.reddit.com/r/mintuit/comments/1azc1np/))
5. **Shutdown / abandonment risk.** Mint's death made longevity a selection criterion: "Quicken has been around for decades, and I only want to do this migration once. Monarch is a startup dependent on VC funding — if that dries up, there goes the company" (70). ([poll thread](https://www.reddit.com/r/mintuit/comments/17n4t30/))
6. **Trust erosion via spam/marketing.** "YNAB... is still email spamming me about their CEO's book despite me opting out" (442pts); "YNAB is going the way of Plex. A once loved app that keeps making unpopular decisions and eroding user trust." ([spam](https://www.reddit.com/r/ynab/comments/1vlor06/))
7. **Inaccurate automation is worse than none.** Monarch recurring: "It's garbage... given how wildly inaccurate the transaction assumptions are" (22). Wrong auto-detection with no off switch actively annoys. ([recurring useless](https://www.reddit.com/r/MonarchMoney/comments/1kwajro/))
8. **Open-source options failing on UX.** People WANT to use Firefly III / Actual but: "either ugly, a huge workflow change, abandoned"; "I switched to Actual Budget... Only the UX/UI is lacking." A polished manual-first app has room here.

## 3. Underserved niches (repeat asks)

- **Non-US users** (UK/EU/Canada/Mexico/India): direct import doesn't cover their banks; they manually enter everything yet pay the same price. "I'm also single, and European, and none of my banks work with auto import... that yearly price is steep" (155 upvotes). Multi-currency + regional pricing + statement-upload workflows serve them directly.
- **Privacy-first / no-credentials users**: refuse to hand bank logins to aggregators on principle; want manual or file-based ingestion.
- **Self-hosters** (r/selfhosted): want open source, local data, Docker; tolerate rough edges but complain about them constantly.
- **Couples / multi-budget households**: shared visibility, per-partner + joint budgets, transfers between budgets without double entry.
- **Spreadsheet refugees**: the top Mint-alternative post on r/personalfinance is a 9,687pt DIY Google Sheet — a huge cohort wants spreadsheet control with app convenience. ([sheet thread](https://www.reddit.com/r/personalfinance/search/?q=mint%20alternative))

## 4. Finzo gap analysis

Finzo today: multi-account, PDF/CSV statement upload with LLM extraction, learning rules for categorization, manual transaction CRUD + splits, budgets, demo onboarding, CSV export. No bank sync, no mobile app, no investments.

### Already aligned with top demands

| Demand | Finzo status |
|---|---|
| #3 CSV/statement upload + auto-categorize | **Core strength.** The 341pt r/personalfinance ask ("upload a spreadsheet... auto categorize... don't need sync") is exactly Finzo's pipeline — and Finzo does PDFs too, which none of the requesters even dared ask for. Lead with this. |
| #2 sync (inverse) | No sync = no sync rage, no aggregator fees, and automatic appeal to the privacy/non-US cohorts. Position as a feature, not a gap. |
| #9 splits, manual CRUD | Covered (splits were an explicit Mint-refugee ask). |
| #12 export / no lock-in | CSV export covered; keep it free forever — it's a trust signal. |
| #1 pricing | Structural advantage: no per-user aggregator costs, so a free/cheap/one-time model is viable. The market is primed to reward it. |

### Gaps, ranked by demand-weight vs. effort

1. **Recurring bills + calendar view (demand #4).** Highest-value gap. Detect recurring transactions per-transaction (learn from Monarch's per-merchant mistake), show a monthly calendar of upcoming bills, and let users mark/unmark manually. Fits Finzo's existing rules engine.
2. **Cash-flow report (demand #7).** Income vs. expense over time, category trends, and "below the line" handling for non-budget cash flows. Modest build on existing data.
3. **Undo + bulk edit (demand #9).** "An UNDO button PLEASE" (90 upvotes) is cheap goodwill. Bulk re-categorize pairs naturally with learning rules.
4. **Multi-currency (demand #8).** Unlocks the exact cohort Finzo's no-sync model already attracts (non-US, manual-first). Per-account currency + a display currency is the 80% version.
5. **Shared/partner mode (demand #5).** Bigger lift (auth/multi-user), but the most-cited "underrated ask." Even read-only shared viewing would differentiate.
6. **Manual investment/net-worth accounts (demand #6).** No sync needed: a manual "asset account" with periodic balance updates gives a net-worth chart. Low effort, high perceived completeness.
7. **Flexible budget targets (demand #10).** Percent-of-income and capped targets on top of existing budgets.
8. **Nested categories / category groups (demand #9).** Budget-by-group was a repeated ask.
9. **Receipt OCR (demand #11).** Finzo already has an LLM extraction engine for statements; pointing it at receipt photos is a natural extension, later.

### Anti-roadmap (what the research says NOT to do)

- Don't add bank sync half-heartedly — broken sync churns users faster than no sync.
- Don't paywall analytics/forecasting if a paid tier ever exists; paywall convenience, not insight.
- Don't ship inaccurate auto-detection without a kill switch (Monarch recurring lesson).
- Don't let export lag behind new data types — lock-in fear is post-Mint table stakes.

---

## Citations

All fetched 2026-08-24; scores as of fetch.

- [What's a feature you wish YNAB had?](https://www.reddit.com/r/ynab/comments/1jf5fh6/whats_a_feature_you_wish_ynab_had/) — r/ynab, 151 comments (calendar view 124, undo 90, capped targets 64, sort 60, account grouping 47, multi-currency 19, nested categories 20)
- [What features do you wish YNAB had?](https://www.reddit.com/r/ynab/comments/zi5l2j/what_features_do_you_wish_ynab_had/) — r/ynab (percent-of-income goals 20, group notes 17, receipt OCR 12, cash-flow page, inter-budget transfers)
- [Really wish YNAB had different subscription options](https://www.reddit.com/r/ynab/comments/104n4n4/really_wish_ynab_had_different_subscription/) — r/ynab, 338pts (manual-entry tier, European sync gap 155, price vs. groceries 20)
- [An Outside Product Manager's Perspective on YNAB's Price Hike](https://www.reddit.com/r/ynab/comments/ql77om/an_outside_product_managers_perspective_on_ynabs/) — r/ynab, 943pts, 305 comments
- [Leaving YNAB After 6 Years – Pricing is the Final Straw](https://www.reddit.com/r/ynab/comments/1ijv9ve/leaving_ynab_after_6_years_pricing_is_the_final/) — r/ynab, 567pts (Actual Budget switchers, regional pricing, "way of Plex")
- [YNAB still email spamming about CEO's book](https://www.reddit.com/r/ynab/comments/1vlor06/ynab_the_company_is_still_email_spamming_me_about/) — r/ynab, 442pts
- [YNAB is Costly and Mint gives your data away... upload transactions, auto categorize?](https://www.reddit.com/r/personalfinance/comments/qyejhc/ynab_is_costly_and_mint_gives_your_data_away_any/) — r/personalfinance, 341pts (subscription resentment 339)
- [Mint ads complaint](https://www.reddit.com/r/personalfinance/comments/a7ymm8/i_have_used_mint_by_intuit_for_6_years_now_but/) — r/personalfinance, 462pts
- [Comparison of Mint Alternatives](https://www.reddit.com/r/mintuit/comments/17vidx5/comparison_of_mint_alternatives/) — r/mintuit, 629pts (splits ask 21, partner collab 7, data-export row)
- [Poll: What Mint alternative are you switching to?](https://www.reddit.com/r/mintuit/comments/17n4t30/poll_what_mint_alternative_are_you_planning_to/) — r/mintuit, 332pts/746 comments (Monarch 82, Simplifi-for-longevity 70, free-only 15)
- [Credit Karma sucks](https://www.reddit.com/r/mintuit/comments/1azc1np/wow_i_cant_believe_how_much_credit_karma_sucks/) — r/mintuit, 336pts
- [Updates on Monarch Plus](https://www.reddit.com/r/MonarchMoney/comments/1stvnik/updates_on_monarch_plus/) — r/MonarchMoney, 790pts (paywall backlash + walk-back; forecasting-in-core 28)
- [Recurring feature is useless?](https://www.reddit.com/r/MonarchMoney/comments/1kwajro/recurring_feature_is_useless/) — r/MonarchMoney, 192pts (per-transaction recurrence, accuracy, off switch)
- [Monarch Money's Investment Tracking Is a Letdown](https://www.reddit.com/r/MonarchMoney/comments/1lr876o/monarch_moneys_investment_tracking_is_a_letdown/) — r/MonarchMoney, 134pts ("would immediately leave" 70)
- [TD Canada plaid connection not updating](https://www.reddit.com/r/MonarchMoney/comments/1t1nvhi/td_canada_plaid_connection_not_updating/) — r/MonarchMoney (representative of constant per-bank sync-failure threads)
- [Actual Budget appreciation post](https://www.reddit.com/r/selfhosted/comments/189eq2a/actual_budget_appreciation_post/) — r/selfhosted, 290pts (Firefly III "ugly... abandoned")
- [Actual Budget going open source](https://www.reddit.com/r/selfhosted/comments/ueott9/actual_budget_going_open_source/) — r/selfhosted, 616pts
- [Alternatives to Firefly III](https://www.reddit.com/r/selfhosted/comments/1rof5dt/alternatives_to_firefly_iii_for_selfhosted/) — r/selfhosted
