# System references and rule adapters

501 Rads retains the original Wasteland system UUID, so existing campaigns and characters stay attached. The plain 5E (2014) system is a separate catalog entry. Both use the shared SRD 5.1 character foundation; system adapters override it rather than placing game-specific conditions in the sheet.

## 501 Rads core-1

The active reference is the author's final 275-page `501 Rads (3).pdf`, copied unchanged with its SHA-256 hash. Heading navigation, lore typography, readable text and the PDF remain available. Table extraction preserves PDF content order so wrapped names stay next to their statistics. The earlier 69-page draft and 125-page mutation revision remain historical assets; current PDF values supersede their mechanics, including the old Gunslinger d10.

The six class definitions, starting skills/equipment, actual shared feats, class resources and source feature descriptions now use core-1. Active effects compose modifiers and conditions and track required aftermaths. See [current coverage, test cases and remaining work](RADS_IMPLEMENTATION.md); target-dependent abilities and descriptive mutations still require GM adjudication. This foundation is not a claim that every ability, legendary weapon, enemy, vehicle and loot rule has been automated.

## Plain 5E

The complete 403-page CC BY 4.0 SRD 5.1 is available as searchable text and an unchanged original PDF, with attribution. This covers the open 2014 rules; supplemental/commercial book content is not included. The twelve SRD classes and nine race/subrace options are available in creation. Race boosts (including Half-Elf choices), size, speed, first-level HP, class saving throws, class hit dice, class progression reminders, ability improvements, and Bard Jack of All Trades are supported.

Creation uses 27-point buy before racial boosts. Level-up supports fixed or rolled hit dice, retroactive Constitution HP changes, Fighter/Rogue extra improvement levels, the maximum-20 improvement rule, the optional SRD Grappler feat, and Barbarian Primal Champion's one-time score/HP increases. Character sheets do not implement a combat simulator. Subclass choices, spells known/prepared, spell slots, equipment, skill selection, conditional features, and other class resources are reviewed using the complete reference and recorded in the existing editable skills/inventory/abilities fields.

## Importing revisions

```powershell
node scripts/import-501-rads.mjs --pdf "R:\Downloads\501Radsdraft1.pdf" --revision draft-1
.codex-tmp/pdf-tools/Scripts/python.exe scripts/import-rads-core.py
python scripts/import-rads-features.py
node scripts/import-5e-srd.mjs
node scripts/import-5e-progression.mjs
```

The 501 importer copies the exact input PDF and writes page-based UTF-8 text plus its SHA-256 hash. Approved corrections can be applied to the app's PDF before importing it; keep PDF text and readable text synchronized. The one-time `scripts/correct-501-rads-pdf.py` correction uses PyMuPDF and the existing VT323 font, preserves the layout and 69-page count, and requires distinct input/output paths. The author's Downloads file is untouched. For a new author revision, import with a new revision identifier, update the hub's active reference, review mechanic changes in the system adapter, and add a new database migration if catalog metadata changes. Text extraction is a reading aid; the PDF remains authoritative for formatting, tables, and illustrations. Mechanical definitions are deliberately maintained separately from imported prose.

Character core payloads remain version 2, with unknown fields preserved. System-specific Heat uses an additive core field; invalid or newer saved payloads are never replaced on load. Save validation uses the active ruleset's score and level limits. Database RLS remains responsible for ownership and campaign authorization.

All future 501 Rads classes are expected to earn and spend a class resource. `CharacterRuleset.classResource` supplies its name, current-value storage adapter, maximum, gain multiplier, help text, and optional long-rest reset. Summary, editor, and creator controls use that definition. 501 Rads defines Heat, Tolerance, Access, Malpractice, Authority and Faith through this adapter.

Run `npm.cmd run build`, `npm.cmd test -- --watch=false`, and `npm.cmd run test:db` after changes to these features or migrations.
