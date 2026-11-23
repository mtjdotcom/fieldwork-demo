# Fieldwork demo

[Open Fieldwork](https://mtjdotcom.github.io/fieldwork-demo/) to explore an artist's work, the gallery that introduced them, and the milestones in their career. [Send feedback](https://github.com/mtjdotcom/fieldwork-demo/issues/new).

The demo uses the Fieldwork dashboard interface. It opens with sample watchlist decisions, public artwork examples and the sourced 2018–2020 gallery programme audit. The acquisition worksheets use fictional works and prices. Following, archiving, editing a worksheet and reviewing a source change save to the current browser. The source monitor replays bundled records.

## Running the demo locally

Run `python3 -m http.server 8000` in this directory and open [the local preview](http://localhost:8000/). GitHub Pages serves the same files from the root of the `main` branch.

## Updating the interface

The Fieldwork app publishes shared interface changes here automatically after a push to its main branch. Maintain the sample records, credited images, historical audit and browser API adapter in this repository. When the app changes its data contract, update the demo adapter and sample records together.

## Fictional auction records

These two examples illustrate how the acquisition desk compares a resale target with documented sales. All artists, lots, transactions and prices in these examples are fictional.

### Sample lot 12

*Tidal Lines*, standard edition, copy 8/30. Sold on 18 September 2025 at a hammer price of USD 440. Unframed with clean margins.

### Sample lot 31

*Tidal Lines*, standard edition, copy 17/30. Sold on 9 April 2026 at a hammer price of USD 510. Unframed and in excellent condition.
