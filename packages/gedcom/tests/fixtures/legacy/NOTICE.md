# legacycustomtags.ged

The gedcom4j sample "legacycustomtags.ged" — Legacy Family Tree's own
custom-tags sample (https://github.com/frizbog/gedcom4j), kept as a
regression fixture for the vendor extension coverage.

The original file contains a `REPO @R0@` pointer inside two `_TODO`
blocks and a `REPO @R1@` pointer under the SOUR record without
defining the `@R0@`/`@R1@` records. Both records were added to the copy
so the strict pointer resolution can parse the file; nothing else was
changed.
