# EMeta

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Inspect file metadata before sharing, remove selected metadata locally, and verify the resulting file. PROJECT_SPEC.md and GitHub issues #1–#4 are the product brief.

## Users

People inspecting their files for embedded location, creator, camera and timestamps before sharing. This audience is inferred from the privacy utility brief.

## Stack

React, TypeScript and Vite, following the existing EQR tool stack for maintainable sibling utilities. No backend or account.

## Capabilities and Constraints

JPEG, PNG, WebP, classic TIFF and HEIC/HEIF inspection and verified metadata removal; PDF Info/XMP cleaning with fresh rewriting and every-page render comparison; supported MP4/MOV/WebM/MKV container metadata cleaning without media recompression. Preserve originals and required content/rendering properties. Refuse ambiguous HEIF rotation, unsafe offsets, signed/encrypted/XFA PDFs, PDFs over 50 pages, encrypted/timed metadata video tracks and unsupported containers. Browser memory imposes documented limits. Files and values remain on the device; no analytics, remote fonts or history. Metadata removal is not redaction or a forensic anonymity guarantee. Static format guides and configurable deployment URLs support crawlable SEO.

## Brand Commitments

EMeta. Built by Yiğit Bayrak · EGORA Digital. Emil Kowalski + Impeccable design direction requested by the user. English is the default; the user requested EQR's seven-language support: English, German, Turkish, Arabic, Japanese, Spanish and Portuguese. Arabic uses right-to-left layout. Direct implementation follows the user's confirmed workflow.

## Product Principles

- Verify removal by reopening the output; never just hide metadata.
- Preserve image appearance and avoid recompression.
- Describe supported scope and limitations honestly.
- Dense, accessible utility UI with light and dark themes.

## Open Decisions

Public deployment address is undecided.
