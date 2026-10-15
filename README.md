# Vedant Finance Strategy

Static HTML/CSS/JavaScript project intended for GitHub and Vercel.

## Files
- `index.html` — page structure
- `style.css` — custom styles
- `script.js` — application JavaScript and Supabase connection

## Deploy on Vercel
1. Upload these files to the root of a GitHub repository.
2. Import that repository in Vercel.
3. Use the Framework Preset `Other`.
4. Leave Build Command empty and Output Directory as `.` (or leave Vercel's static-site defaults).
5. Deploy.

## Supabase
The app uses the Supabase project URL and publishable key embedded in `script.js`. The app expects the `settings`, `assets`, `salary`, and `expenses` tables with the columns used by the JavaScript. Configure suitable Row Level Security policies in Supabase before putting personal financial data online.

## Important note
The files are split into separate files and the visible app name is changed to “Vedant Finance Strategy”. The pasted source includes existing references to `totalSalaryInput` and `totalExpensesInput`, but no matching elements in the supplied HTML. The original salary/expense helper code can therefore error on page load unless those elements are added. This was not changed in this package to avoid changing the supplied behavior.
