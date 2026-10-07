# UI crawl

Screenshots every page of the app so a styling change can be checked by eye.

```sh
npm run build && npx next start --port 3005      # in one terminal
cd scripts/ui-crawl
npm i                                             # playwright, uses your installed Chrome
node login.mjs                                    # opens Chrome; sign in once, saves state.json
node crawl.mjs                                    # writes shots/*.png
```

`state.json` and `shots/` are git-ignored: the session is yours and the images
are throwaway. The scripts expect the app on http://localhost:3005.
