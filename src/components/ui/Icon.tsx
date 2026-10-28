/** Hand-drawn 24px stroke icons; decorative unless the caller labels the control. */
const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M7 7l10 10M17 7L7 17',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  rotate: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5v14M16 5v14',
  flame: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.5-5.3 3.6-8.3.4 1.6 1.4 2.7 2.4 3.3.2-2.6 1.3-5 3.5-6.8-.3 2.7.8 4.6 2 6.3 1.1 1.6 1.5 2.9 1.5 4.8 0 4-2.6 6.9-6.5 6.9z',
  info: 'M12 11v6M12 7.5v.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5z',
  clipboard: 'M9 4h6v3H9zM7 5.5H5.5V21h13V5.5H17M9 12h6M9 16h4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, strokeWidth = 2 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
