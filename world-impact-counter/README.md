# World impact counter

Separate, phone-first static counter. No AR, TV or TRADESIGHT project files are used. Three independent flow counters use published average annual rates; there is no combined score, shared severity scale or arbitrary gauge maximum. The separate NOAA daily atmospheric CO2 trend is in ppm and is never integrated into emissions.

## Run and verify

Requires Node.js 18+. Run `npm start` and open http://127.0.0.1:4173. Run `npm test` for automated clock, ledger, missing-input, dataset validation and NOAA failure/recovery tests. No dependencies need installing. The development server binds only to this PC; direct phone access needs a separately approved hosted deployment.

Start begins active time. The same button pauses/resumes. Reset stops and zeros. Reload begins a new timer session. Screen updates every second, but elapsed timestamps determine amounts, including throttled background-tab gaps. Device sleep behavior depends on browser/OS. No accounts, analytics, private uploads or paid services are used.

## Data and refreshing

`data/indicators.json` is the complete exportable dataset with schema/version, verification date, source publication dates, reference periods, annual rates, units, scope, trend evidence and limitations. Research supplied and verified by the parent research task on 2026-10-27. All rates use 31,536,000 seconds per 365-day year.

- Fossil/industrial CO2: 38.1 billion tonnes, 2025 estimate/projection; final paper +1.0% supersedes earlier press +1.1%. Not all greenhouse gases or atmospheric accumulation.
- Gross deforestation: 10.9 million hectares/year, 2015-2025 historical average; not net forest loss or trees. Improving versus 1990-2000.
- Food waste: 1.05 billion tonnes, 2022 estimate including inedible parts; excludes pre-retail losses. Cross-edition trend not established.

Refresh now and five-minute polling check only the same-origin bundled JSON. They do not discover official publisher updates. An unchanged valid fetch updates last successful check only. Invalid/failed checks retain the last validated dataset and timestamp and show an error. The download exports that validated snapshot. Checks occur only while open, may be throttled in a background tab, and catch up if due when visible. No external scheduled job exists.

Data revisions require a new `version`, `schemaVersion: 1`, `yearSeconds: 31536000`, and valid indicator inputs. An empty indicator array shows unavailable state. Invalid datasets are rejected as a whole. Keep ID/unit stable when changing a rate; changed units require a new ID. New rates apply prospectively without rewriting accrued amounts. New indicators exclude earlier active time when no rate was available. Reset starts with current rates.

NOAA fetches https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_trend_gl.csv on Start, manually and hourly while open after the first request. The daily seasonally adjusted `trend` is displayed with its data date and separate last successful fetch. Based on four baseline observatories; not an instantaneous direct global measurement. Recent estimates may be revised and no update SLA is promised. Schema, dates, plausible ranges and missing-value sentinels are validated. A failed request retains the dated last validated cached CSV/snapshot in localStorage; invalid data never becomes a zero observation. No credentials are sent. Source-file update time is unavailable. Methodology: https://gml.noaa.gov/ccgg/trends/gl_trend.html .

All app text is inserted via DOM text nodes. No external fonts/scripts are loaded. Only the NOAA request and user-selected source links leave the origin. The development server serves only explicitly allowed static assets.

## Export

Retain and copy the ordinary source files in this folder. Source is `index.html`, `styles.css`, `src/`, `data/`, `server.mjs`, `package.json`, and tests under `test/`. No archive is required. No build step is required. Static hosting serves `index.html` and its relative assets; use `.nojekyll` for GitHub Pages. Do not use `file://` because module/data loading requires HTTP.

Each flow has its own quantity gauge with real units and an automatically expanding decimal axis. These are amount axes, not severity thresholds or percentages of an overall score. The needle can move back when the axis expands; accrued totals remain continuous. Metric colors distinguish indicators; separate text labels convey trends.

Small-text readability baseline, 2026-10-27: all 29 explicit 8-15px font declarations from commit `a52cd609` were increased by exactly 4 CSS pixels, using fixed absolute sizes. Large headings, gauge numerals and icons retain their original sizes. `test/fixtures/styles.before-readability.css` records the prior CSS; `test/readability.test.mjs` guards against repeated increments and preserves narrow-width reflow rules. Labels may wrap and the controls stack at 360px and below. These source checks do not replace browser layout acceptance, which remains blocked.

## Verification limits

Automated tests cover timing, rate changes, validation and retained-data failure/recovery. Browser integration, actual browser CORS, mobile visual QA and public deployment must be verified separately before calling the app production-ready.
