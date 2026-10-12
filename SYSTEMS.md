# System references and rule adapters

501 Rads retains the original Wasteland system UUID, so existing campaigns and characters stay attached. The plain 5E (2014) system is a separate catalog entry. Both use the shared SRD 5.1 character foundation; system adapters override it rather than placing game-specific conditions in the sheet.

## 501 Rads draft 1

The system hub contains every page of the 69-page author-provided PDF, searchable as lore or rules, with a PDF download. Navigation uses headings and displays each section through its next heading, including text continuing onto later pages. Lore uses the document's Atomic Age headings and VT323 body font, self-hosted with their OFL licenses. Pages 58 onward contain rules. At the author's request, the downloadable PDF and readable text now correct Fan the Hammer's “luck points” typo to Heat. Other author clarifications are displayed separately.

Implemented clarifications: maximum level 12; scores may exceed 20; two ability points every level; shared feat choices at levels 3/6/9/12; Gunslinger d10 HP with fixed 6 or a roll plus Constitution; Fan the Hammer costs 2 Heat. Feats are not defined yet. The optional testing placeholder has no mechanical effect and is clearly labeled.

Gunslinger creation and level-up add unlocked ability references. Heat gains, costs, maximums, long-rest reset, and level-based gain multipliers are tracked on the edit page and saved with the character. Attack resolution, advantage, automatic kill effects, probability of Divine Intervention consequences, creature stat blocks, drugs, and item statistics are not invented where the draft does not supply them. Resolve narrative and combat effects with the GM using the feature text and original reference.

## Plain 5E

The complete 403-page CC BY 4.0 SRD 5.1 is available as searchable text and an unchanged original PDF, with attribution. This covers the open 2014 rules; supplemental/commercial book content is not included. The twelve SRD classes and nine race/subrace options are available in creation. Race boosts (including Half-Elf choices), size, speed, first-level HP, class saving throws, class hit dice, class progression reminders, ability improvements, and Bard Jack of All Trades are supported.

Creation uses 27-point buy before racial boosts. Level-up supports fixed or rolled hit dice, retroactive Constitution HP changes, Fighter/Rogue extra improvement levels, the maximum-20 improvement rule, the optional SRD Grappler feat, and Barbarian Primal Champion's one-time score/HP increases. Character sheets do not implement a combat simulator. Subclass choices, spells known/prepared, spell slots, equipment, skill selection, conditional features, and other class resources are reviewed using the complete reference and recorded in the existing editable skills/inventory/abilities fields.

## Importing revisions

```powershell
node scripts/import-501-rads.mjs --pdf "R:\Downloads\501Radsdraft1.pdf" --revision draft-1
node scripts/import-5e-srd.mjs
node scripts/import-5e-progression.mjs
```

The 501 importer copies the exact input PDF and writes page-based UTF-8 text plus its SHA-256 hash. Approved corrections can be applied to the app's PDF before importing it; keep PDF text and readable text synchronized. The one-time `scripts/correct-501-rads-pdf.py` correction uses PyMuPDF and the existing VT323 font, preserves the layout and 69-page count, and requires distinct input/output paths. The author's Downloads file is untouched. For a new author revision, import with a new revision identifier, update the hub's active reference, review mechanic changes in the system adapter, and add a new database migration if catalog metadata changes. Text extraction is a reading aid; the PDF remains authoritative for formatting, tables, and illustrations. Mechanical definitions are deliberately maintained separately from imported prose.

Character core payloads remain version 2, with unknown fields preserved. System-specific Heat uses an additive core field; invalid or newer saved payloads are never replaced on load. Save validation uses the active ruleset's score and level limits. Database RLS remains responsible for ownership and campaign authorization.

Run `npm.cmd run build`, `npm.cmd test -- --watch=false`, and `npm.cmd run test:db` after changes to these features or migrations.
