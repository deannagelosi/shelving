# Uniquely Shaped Spaces

![Uniquely Shaped Spaces workflow](img/software.png)

Generate and fabricate custom shelving that “wraps” around the silhouettes of your own objects.

[https://deannagelosi.github.io/shelving](https://deannagelosi.github.io/shelving)

---

## What you’ll make

- A custom shelf design where each object gets a fitted void (based on its 2D silhouette).
- A fabrication-ready **DXF** export with **numbered parts** and **joinery** so you can laser cut and assemble.

> Note: the tool is built to guarantee *geometric* fabricability (clean intersections, cuttable parts), not structural engineering. Use common sense about material choice, span lengths, and load.

---

## Workflow

### 1) Gather + photograph your objects
Pick a small collection you want to display (mementos, ceramics, artifacts, etc.).

Photo tips:
- Use a **plain, high-contrast background** (white works well).
- Include a **ruler in every photo** so scale stays consistent across objects.
- Keep camera angle consistent (straight-on is easiest).

### 2) Set your grid scale in the tool
Before importing photos, set the grid dimensions based on the **largest object’s height and width**.

- Each grid cell corresponds to a real-world unit (the interface uses a **¼-inch grid**), so your shelf dimensions will match your collection.

### 3) Upload each object and make a mask
For each object:
- Click **Upload image**.
- Use the **auto-mask slider** to get a rough outline.
- Refine by clicking individual grid cells to clean edges and fix gaps.
- **Save** the object (give it a name). Saved objects appear in your list for layout generation.

Masking advice:
- If you want a *tighter* visual fit, you can mask slightly **smaller** than the photo silhouette.
- If you want easier placement/removal, mask slightly **larger** (leave clearance).

### 4) Choose objects for this shelf
In the object list, toggle which shapes you want included in the generated shelf.

This is a powerful lever:
- Fewer objects → more breathing room, often simpler shelves.
- Removing one awkward object can dramatically improve the overall footprint.

### 5) Generate layouts (and curate)
Click **Generate** to start a layout search. You’ll see an animation as objects rearrange.

When it finishes:
- The tool grows walls around/between objects automatically.
- Click **Generate** again to explore more options.
- **Save** any promising layouts so you can compare them side-by-side in the results stack.

Curation tips:
- If you have a target silhouette (tall/narrow vs. short/wide), you may need to:
  - try different subsets of objects, or
  - re-mask one object to change how “dominant” it is in the layout.
- Don’t aim for a single “perfect” run—treat generation as browsing a set of candidates.

### 6) Pick one layout and prep it for fabrication
In the **Solutions/Export** panel:
- Select the layout you want to fabricate.
- Set fabrication parameters (at minimum):
  - **Material thickness** (match your sheet stock)
  - **Board depth** (how far the shelf extends out from the wall): set to your deepest object
  - **Kerf** (if you know it for your laser/material)

Use **Show Design** (preview) to check:
- overall footprint (will it fit your space?)
- part count and orientation
- part numbering for assembly

### 7) Export DXF
Export a **DXF** containing all boards with joinery and labels.

### 8) Cut, assemble, and install
Typical process:
- Laser cut the parts from plywood or acrylic.
- Dry-fit first, then glue/clamp in sub-assemblies (often easier than “all at once”).
- Sand/finish as needed.
- Install (wall-mounted or tabletop) and place objects.

---

## Troubleshooting

**My layouts are huge or awkward**
- Try removing one object that forces a wide footprint.
- Re-mask the “dominant” object (often the widest/tallest).
- Generate several times and compare saved candidates.

**A void is too tight / too loose**
- Adjust the mask for that object (smaller = tighter void; larger = more clearance).
- Re-generate and re-check.

**The tool doesn’t give me the “shape” I want (e.g., tall and narrow)**
- Change the object subset (even removing one object can shift the overall aspect).
- Generate many candidates, then curate.

**Something looks unbuildable**
- Confirm material thickness and kerf settings.
- If the shelf is large, consider thicker stock, fewer objects, or a smaller target footprint.

---

## Safety + scope note

Uniquely Shaped Spaces guarantees **geometric cuttability**, not structural safety. If you plan larger shelves or heavier objects, add your own structural checks (shorter spans, thicker stock, mounting strategy, etc.).

## License

Code: MIT License (see LICENSE).

Text: CC BY 4.0
