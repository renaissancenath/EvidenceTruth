/* Project icon set: 20 px grid, 1.5 px stroke, square caps, currentColor (DESIGN_SYSTEM.md §8).
   The same paths are exported as SVG files in design/icons/ by scripts/export_icons.mjs. */
import type { SVGProps } from "react";

export const ICON_PATHS = {
  supported: '<path d="M4.5 10.5 8.25 14.25 15.5 6"/>',
  contradicted: '<path d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5"/>',
  partially_supported: '<circle cx="10" cy="10" r="6.25"/><path d="M10 3.75a6.25 6.25 0 0 1 0 12.5Z" fill="currentColor" stroke="none"/>',
  unsubstantiated: '<circle cx="10" cy="10" r="6.25"/><path d="M5.75 14.25 14.25 5.75"/>',
  misleading: '<path d="M10 3.5 17 16H3Z"/><path d="M10 8.25v3.5M10 13.75v.5"/>',
  outdated: '<circle cx="10" cy="10" r="6.25"/><path d="M10 6.5V10l2.5 1.75"/>',
  insufficient_evidence: '<path d="M7.25 7.5a2.75 2.75 0 1 1 3.9 2.5c-.75.35-1.15.9-1.15 1.75v.75"/><path d="M10 15.25v.5"/>',
  not_checkable: '<path d="M5.5 10h9"/>',
  loop: '<path d="M14.75 7.75A5.25 5.25 0 1 0 15.25 11"/><path d="M15 4.25v3.75h-3.75"/>',
  paused: '<path d="M7.25 5v10M12.75 5v10"/>',
  logo: '<path d="M6.5 3.75H3.75v12.5H6.5M13.5 3.75h2.75v12.5H13.5M7.75 10h4.5"/>',
  scan: '<path d="M3.75 7V3.75H7M13 3.75h3.25V7M16.25 13v3.25H13M7 16.25H3.75V13M6.5 10h7"/>',
  document: '<path d="M5 2.75h6.5l3.5 3.5v11H5Z"/><path d="M11.5 2.75v3.5H15M7.5 10h5M7.5 13h5"/>',
  citation: '<path d="M4.25 6.5h4.5v4.5H6.5v2.5M11.25 6.5h4.5v4.5H13.5v2.5"/>',
  code: '<path d="M7 6 3.25 10 7 14M13 6l3.75 4L13 14M11.25 4.5 8.75 15.5"/>',
  calculator: '<path d="M4.75 2.75h10.5v14.5H4.75Z"/><path d="M7.25 5.75h5.5M7.25 10h.5M10 10h.5M12.25 10h.5M7.25 13h.5M10 13h.5M12.25 13h.5"/>',
  history: '<path d="M3.75 10a6.25 6.25 0 1 0 1.8-4.4"/><path d="M3.75 3.75v3.5h3.5M10 6.5V10l2.5 2"/>',
  chat: '<path d="M3.75 4.25h12.5v9H9l-3.5 2.5v-2.5H3.75Z"/>',
  dashboard: '<path d="M3.75 16.25h12.5M6 13.5v-3M10 13.5V6M14 13.5V8.5"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function EtIcon({ name, size = 20, title, ...rest }: { name: IconName; size?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      focusable="false"
      {...rest}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title.replace(/[<>&]/g, "")}</title>` : "") + ICON_PATHS[name] }}
    />
  );
}
