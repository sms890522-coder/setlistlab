# Character assets

Profile characters are selected from finished WebP preset images.

Recommended:

- WebP first
- Transparent background
- 1:1 ratio
- 512x512 or 1024x1024 source
- Keep silhouettes readable at 64-96px

Base preset path:

```text
{gender}-{instrument}.webp
```

Additional style preset path:

```text
presets/{gender}-{instrument}-{variant}.webp
```

Supported variants:

- classic: existing base image
- soft
- warm
- vivid

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

Layer assets under `layers/` are kept for future experiments, but the current profile character UI uses finished preset images.
