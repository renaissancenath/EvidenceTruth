# Browser walkthroughs (Playwright)

Software tests that drive the real app in Chromium. They are not evaluation results.

```bash
# 1. start the backend serving the built web app (console email backend prints sign-in links into server.log)
cd backend && ET_DATABASE_URL=sqlite:///./e2e.db python -m app.store.migrate upgrade
cp ../e2e/fixtures/demo-answer.html web/   # a fake chat page with ChatGPT-style markup, used by the extension test
ET_DATABASE_URL=sqlite:///./e2e.db uvicorn app.main:app --port 8000 > ../server.log 2>&1 &
# 2. run
cd .. && node e2e/web.e2e.cjs design/screenshots/$(date +%F)
node e2e/extension.e2e.cjs design/screenshots/$(date +%F)
```

`web.e2e.cjs`: magic-link sign-in, onboarding, document upload, check, results, every app page, phone width overflow check, light and dark.
`extension.e2e.cjs`: loads `extension/dist` unpacked, pairs with a code from Settings, scans the demo chat page, reads the side panel, checks the in-page underlines, and checks that Pause blocks scanning.
