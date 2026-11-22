# Fieldwork demo

[Open Fieldwork](https://mtjdotcom.github.io/fieldwork-demo/) to explore an artist's work, the gallery that introduced them, and the milestones in their career. [Send feedback](https://github.com/mtjdotcom/fieldwork-demo/issues/new).

The demo uses the Fieldwork dashboard interface. It opens with sample watchlist decisions, public artwork examples and the sourced 2018–2020 gallery programme audit. The acquisition worksheets use fictional works and prices. Following, archiving, editing a worksheet and reviewing a source change save to the current browser. The source monitor replays bundled records.

## Running the demo locally

Run `python3 -m http.server 8000` in this directory and open [the local preview](http://localhost:8000/). GitHub Pages serves the same files from the root of the `main` branch.

## Updating the interface

The Fieldwork app publishes shared interface changes here automatically after a push to its main branch. Maintain the sample records, credited images, historical audit and browser API adapter in this repository. When the app changes its data contract, update the demo adapter and sample records together.
