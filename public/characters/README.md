# Character assets

Profile characters are rendered from transparent WebP/PNG layers.

Recommended:

- WebP first, PNG also works
- Transparent background
- 1:1 ratio
- Every layer must use the same canvas size and anchor point
- 512x512 or 1024x1024 source
- Keep silhouettes readable at 64-96px

Current layer paths:

```text
layers/base/{gender}-body-01.webp
layers/face/face-{faceShape}-01.webp
layers/expression/{expression}-01.webp
layers/hair/{gender}-{hairStyle}-01-{hairColor}.webp
layers/outfit-top/top-{topStyle}-01-{topColor}.webp
layers/outfit-bottom/bottom-basic-01-{bottomColor}.webp
layers/instrument/{instrument}.webp
```

Supported instruments:

- none
- vocal
- keyboard
- electric-guitar
- acoustic-guitar
- bass
- drums
- cajon
- leader
- in-ear
- engineer
- broadcast-room

Legacy full-character files can remain in this folder for compatibility, but new profile rendering uses the `layers` directory.
