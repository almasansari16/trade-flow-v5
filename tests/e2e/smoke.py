"""Smoke test: every demo account signs in and every reachable nav page renders without console errors."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
PW = 'TradeFlow@2026'
ACCOUNTS = ['omar.haddad@gulfhorizon.example','daniel.okafor@tradeflow.example','marcus.chen@tradeflow.example','priya.nair@tradeflow.example','elena.petrova@tradeflow.example','faisal.rahman@tradeflow.example','huda@desertbloom.example','neema@lagoonbeauty.example','jonas@nordlicht.example']
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for email in ACCOUNTS:
        ctx = b.new_context(viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        page.on('console', lambda m, e=email: m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and errors.append((e, page.url, m.text)))
        page.on('pageerror', lambda ex, e=email: errors.append((e, page.url, str(ex))))
        page.goto(BASE + '/login')
        page.get_by_label('Email').fill(email)
        page.locator('input[autocomplete=current-password]').fill(PW)
        page.get_by_role('button', name='Sign in', exact=True).click()
        page.wait_for_url('**/app**')
        page.wait_for_timeout(700)
        links = page.locator('nav[aria-label="Main navigation"] a').evaluate_all('els => els.map(e => e.getAttribute("href"))')
        print(email, '→ landing', page.url.replace(BASE, ''), '| nav:', len(links))
        for href in links:
            page.goto(BASE + href)
            page.wait_for_timeout(650)
            if page.get_by_text('Error 403').count():
                errors.append((email, href, 'nav item leads to 403'))
            # open first detail row if table exists
        ctx.close()
    b.close()
print('\nERRORS:', len(errors))
for e in errors[:40]: print(e)
