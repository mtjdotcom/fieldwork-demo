"""Copy the Fieldwork interface from a local checkout into the Pages demo."""
import argparse
import json
from pathlib import Path
import shutil


def sync(source, destination):
    public = source / "public"
    # Only shared interface files belong here. Demo records have their own dataset.
    scripts = ("worksheet", "profile", "gallery-tiers", "network", "discovery-order",
               "discovery-views", "discoveries", "app")
    styles = ("worksheet", "profile", "discoveries", "style")
    for name in styles:
        shutil.copyfile(public / (name + ".css"), destination / (name + ".css"))

    index = (public / "index.html").read_text().replace('href="/', 'href="./').replace('src="/', 'src="./')
    index = index.replace('<script defer src="./worksheet.js">',
                          '<script defer src="./demo-projection.js"></script>\n'
                          '    <script defer src="./demo-api.js"></script>\n'
                          '    <script defer src="./worksheet.js">')
    (destination / "index.html").write_text(index)
    for name in scripts:
        path = name + ".js"
        code = (public / path).read_text()
        if name == "app":
            code = code.replace('fetch("/images/credits.json")', 'fetch("./images/credits.json")')
            code = code.replace('Local workspace ${icon("database", 14)}',
                                'Demo workspace <a href="https://github.com/mtjdotcom/fieldwork-demo/issues/new" '
                                'target="_blank" rel="noopener noreferrer">Feedback</a>')
            code = code.replace("The local server is unavailable.", "Browser storage is unavailable.")
        if name in ("network", "gallery-tiers"):
            code = code.replace('href="/research/', 'href="./')
        if name == "network":
            code = code.replace("Checks run while the local server is open. A first successful check saves a baseline and imports artist profiles from linked gallery rosters. Subsequent text changes appear for review.",
                                "This demo replays sample source records. Your settings and reviewed changes stay in this browser.")
            code = code.replace("Check public gallery, marketplace and auction pages", "Review sample gallery, marketplace and auction pages")
        if name == "app":
            code = code.replace("Check public gallery, marketplace and auction pages for new evidence.",
                                "Check sample gallery, marketplace and auction records for new evidence.")
        if name == "discoveries":
            code = code.replace(r"^\/work-images\/", r"^work-images\/")
        if name == "profile":
            # Keep the original public demo's reversible decisions in the artist profile.
            code = code.replace("${statusButtons}</div>",
                                "${statusButtons}${artist.status !== 'discovered' ? button('inbox',artist.id,'Return to inbox') : ''}</div>")
            code = code.replace("action==='archive' || action==='follow'",
                                "action==='archive' || action==='follow' || action==='inbox'")
            code = code.replace("status:action==='archive'?'archived':'watching'",
                                "expectedStatus:artist.status,status:{archive:'archived',follow:'watching',inbox:'discovered'}[action]")
            code = code.replace("action==='archive'?'Artist archived':'Added to watchlist'",
                                "{archive:'Artist archived',follow:'Added to watchlist',inbox:'Returned to discovery inbox'}[action]")
        if name == "worksheet":
            code = code.replace(r"^\/images\/", r"^images\/")
        (destination / path).write_text(code)

    image_dir = destination / "images"
    image_dir.mkdir(exist_ok=True)
    credits = json.loads((public / "images/credits.json").read_text())
    examples = {}
    for artist in ("oscar-murillo", "issy-wood", "nnena-kalu", "jesse-darling", "nat-faulkner"):
        record = credits[artist].copy()
        record["image"] = record["image"].lstrip("/")
        shutil.copyfile(public / record["image"], destination / record["image"])
        examples[artist] = record
    (image_dir / "credits.json").write_text(json.dumps(examples, indent=2, ensure_ascii=False) + "\n")

    stem = "gallery-programmes-2018-2020"
    shutil.copyfile(public / "research" / (stem + ".json"), destination / (stem + ".json"))
    audit = (public / "research" / (stem + ".html")).read_text()
    (destination / (stem + ".html")).write_text(audit.replace('href="/#galleries"', 'href="./#galleries"'))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkout", type=Path)
    args = parser.parse_args()
    sync(args.checkout, Path(__file__).resolve().parents[1])
