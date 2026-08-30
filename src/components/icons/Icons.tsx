/**
 * Icons - hand-authored inline SVG icon set for the command palette.
 *
 * Every icon shares one treatment: a 24x24 viewBox, `fill="none"`,
 * `stroke="currentColor"` and a 1.75 stroke width, so an icon inherits the
 * `color` of whatever context renders it. Size is controlled by the caller via
 * `className` (defaults to Tailwind's `w-4 h-4`).
 *
 * Each `<svg>` is `aria-hidden` by default: icons here are decorative, and the
 * two that carry standalone meaning (speaker, pin) are labelled by their
 * wrapping element in `SearchResultItem`.
 */

export interface IconProps {
  /** Tailwind sizing/color classes. Defaults to a 16x16 box. */
  className?: string;
}

/** Shared presentational attributes for every icon in the set. */
const strokeProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
} as const;

/** Speaker with sound waves - marks a tab that is currently playing audio. */
export const SpeakerIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18.5 6a8 8 0 0 1 0 12" />
  </svg>
);

/** Push pin - marks a pinned tab. */
export const PinIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M12 16.5V22" />
    <path d="M9 2h6l-1.2 5.5 3.2 3.2v2H7v-2l3.2-3.2L9 2Z" />
  </svg>
);

/** Folder - decorative marker for a tab-group row. */
export const FolderIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M3 7a2 2 0 0 1 2-2h3.7a2 2 0 0 1 1.6.8l.9 1.2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </svg>
);

/** Magnifying glass - illustrates the empty "no results" state. */
export const SearchIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="m16.2 16.2 4.3 4.3" />
  </svg>
);

/** Lightning bolt - marks an executable action row. */
export const BoltIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

/** X - marks a "close this tab" action row. */
export const CloseIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

/** Warning triangle - illustrates the error state. */
export const AlertIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5" />
    <path d="M12 17.2h.01" />
  </svg>
);

/**
 * Circular progress arc - illustrates a long-running operation.
 * The caller supplies the rotation (Tailwind's `animate-spin`).
 */
export const SpinnerIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <circle cx="12" cy="12" r="9" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </svg>
);
