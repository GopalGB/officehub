# Catalyst Brands workspace

## Add your logo

Place your PNG at the repository root:

```text
officehub/
├── logo.png       ← your logo goes here
├── package.json
├── src/
└── ...
```

There is no need to move it into `public` or edit a component. The public `/brand/logo` route reads that fixed root filename and uses `Cache-Control: no-store`, so a normal self-hosted process picks up replacements immediately. Keep the filename lowercase and ensure the app can read the file.

The desktop sidebar, mobile navigation drawer, sign-in, sign-up, and invitation screens reserve a consistent logo area. The image keeps its original aspect ratio using `object-fit: contain`. The logo wrapper has no background color, border, shadow, or image filter. A transparent PNG displays directly on the surrounding page surface; use artwork with enough contrast on white. A wide image at least 352 × 88 pixels is recommended, but other proportions are supported.

Until `logo.png` exists, the slot displays a plain Catalyst Brands text fallback. No official logo file is bundled or downloaded by the application.

## Docker and standalone builds

Add `logo.png` **before building** to include it in the standalone output and Docker image. `next.config.ts` explicitly traces this optional file, and Docker's existing standalone copy includes it. An empty `public` directory is tracked so Docker's public-assets copy also works before any assets are added.

To replace the logo in an existing Docker deployment, rebuild the image, or mount your existing PNG read-only at `/app/logo.png`. For example, add the following entry to the app service's existing `volumes` list only after the source file exists:

```yaml
- type: bind
  source: ./logo.png
  target: /app/logo.png
  read_only: true
  bind:
    create_host_path: false
```

A mount is optional; the default configuration starts without any logo file.

## Theme reference

The palette and typography were observed on [Catalyst Brands' official homepage](https://www.catalystbrands.com/) on 27 October 2026. These are website styling references, not a published brand manual.

| Use | Color |
| --- | --- |
| Primary actions and headings | Navy `#091F36` |
| Focus, selected navigation, brand accents | Orange `#DD6328` |
| Blue accents | Blue `#0084D4` |
| Small interactive text | Darker blue `#006BA8`, adapted for contrast on white |
| Selected surfaces | Warm tint `#FFF3EB` |
| Cards and content | White |

The font stack is Helvetica Neue, Helvetica, Arial, sans-serif, without external font requests. Main actions use navy with white text; selected navigation uses orange borders and warm surfaces. Success and error colors remain semantic.

The homepage links [a white Catalyst Brands logo](https://www.catalystbrands.com/images/catalystbrands_white_logo.png). It is provided here as a source reference; supply your chosen approved artwork as `logo.png`.

Theme tokens live in `src/app/globals.css` and `tailwind.config.ts`. The shared logo slot is `src/components/layout/BrandIdentity.tsx`; the logo endpoint is `src/app/brand/logo/route.ts`.
