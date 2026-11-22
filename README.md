# Fieldwork demo

[Open Fieldwork](https://mtjdotcom.github.io/fieldwork-demo/) to explore an artist's work, the gallery that introduced them, and the milestones in their career. [Send feedback](https://github.com/mtjdotcom/fieldwork-demo/issues/new).

The demo uses the Fieldwork dashboard interface. It opens with sample watchlist decisions, public artwork examples and the sourced 2018–2020 gallery programme audit. The acquisition worksheets use fictional works and prices. Following, archiving, editing a worksheet and reviewing a source change save to the current browser. The source monitor replays bundled records.

## Running the demo locally

Run `python3 -m http.server 8000` in this directory and open [the local preview](http://localhost:8000/). GitHub Pages serves the same files from the root of the `main` branch.

## Updating the interface

Run `python3 tools/sync_interface.py /path/to/fieldwork` with the path to a Fieldwork checkout. The script copies the shared frontend, selected credited artwork and the public audit. It adapts links for GitHub Pages. The demo workspace lives in `demo-state.json` and the browser adapter lives in `demo-api.js` and `demo-projection.js`. After changing the local app’s data contract, check the corresponding adapter behaviour before publishing.
