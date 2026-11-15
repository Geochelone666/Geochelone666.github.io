# Windsor Rooms · COMP lab finder (Fall 2026)

Site: https://geochelone666.github.io/windsor-rooms/

## Coverage

- 956 courses indexed, 1,824 weekly classroom/day meetings, 806 exam records with a room.
- 64 COMP courses, 12 physical COMP LAB venues, 34 distinct LAB sections.
- 83 out of 83 physical COMP class numbers with matched instructor names, based on authenticated UWinsite section details.
- 4 School of Computer Science general-use workstation labs, separately from regular classrooms that host LAB classes.
- Campus-wide 183 room/facility entries, including 17 computer facilities/subdivisions; counts do not imply public access.

## Features

- Date-range-aware occupancy, exams, and weekly view.
- Smart finder based on free *scheduled* intervals, with a minimum contiguous gap setting and optional unverified locations.
- Side-by-side occupancy comparison for up to three rooms and CSV export.
- Per-room calendar export (ICS; local times converted to UTC using America/Toronto rules). Holidays and changes must be verified independently.
- Class/instructor details and source/quality notices.
- Field notes, CPU/GPU/model, local photo attachment and JSON backup/import (localStorage only). **Notes and photos are not uploaded.**

## Updating next semester

`tools/data_pipeline.py` is a deterministic CSV importer and validator. It consumes the explicit `Windsor_Rooms_v3_Full_Schedule.csv` schema, validates times, term dates, class numbers, exam dates, room identity, and COMP lab coverage. Provide the new semester's verified CSV export and a base JSON metadata file. It does not scrape university sources or fabricate missing rooms; the next full-term timetable may not yet be published.

Example (do not overwrite production data until reviewed):

```bash
python3 tools/data_pipeline.py validate --data source.json
python3 tools/data_pipeline.py import --csv winter2027.csv --base previous.json --term 'Winter 2027' --start 2027-01-04 --end 2027-04-30 --out winter2027.json
```

Then inspect generated `winter2027.json` and `winter2027.json.gz` and independently test the updated website before deploying. This script is a **data importer only**, not automated course collection.

## Limitations

No real-time availability, door status, access authorization, temporary bookings, full holiday exceptions, or guarantees of hardware models; the schedule snapshot was assembled November 13–15, 2026. Some courses/exams lacked precise physical rooms and were excluded from occupancy calculations, not assumed to be free.

The mobile site works without a login. `noindex,nofollow` is requested but is not a privacy/security boundary: campus classroom data on GitHub Pages is publicly accessible. Personal notes live only in browser localStorage.

### Sources
- https://www.uwindsor.ca/registrar/541/timetable-information
- https://student.uwindsor.ca/
- https://help.cs.uwindsor.ca/books/labs
- https://ctl2.uwindsor.ca/classrooms/
