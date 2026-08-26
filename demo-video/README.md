# Sensorium demo video

The public hackathon demo is authored with Remotion so the submitted film is reproducible from the repository. It combines production screenshots, a generated narration track, and frame-driven motion.

```bash
npm install
npm run still
npm run render
```

Outputs are written to `out/`:

- `sensorium-thumbnail.png` — 1280×720 YouTube thumbnail
- `sensorium-webmcp-demo.mp4` — 1920×1080, 30 fps, 2:26 narrated demo

The film identifies the São Paulo station as deterministic simulation and the Belém station as a physical browser capture. Raw sensor media is not included; all UI images show derived evidence from the public application.
