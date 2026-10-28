import type { ReactNode, SVGProps } from 'react';

/** Icons from the Listening App design (24×24, drawn in currentColor). */
type IconProps = SVGProps<SVGSVGElement>;

const filled = (path: string) =>
  function FilledIcon(props: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
        <path d={path} />
      </svg>
    );
  };

export const PlayIcon = filled('M8 5v14l11-7z');
export const PauseIcon = filled('M7 5h4v14H7zM13 5h4v14h-4z');
export const NextIcon = filled('M6 5v14l9-7zM16 5h2.5v14H16z');
export const PrevIcon = filled('M18 5v14L9 12zM5.5 5H8v14H5.5z');
export const AgainIcon = filled('M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z');

const stroked = (children: ReactNode) =>
  function StrokedIcon(props: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...props}
      >
        {children}
      </svg>
    );
  };

export const BackIcon = stroked(<path d="M15 5l-7 7 7 7" />);
export const PathIcon = stroked(
  <>
    <path d="M4 20c4-1 4-5 8-6s5-4 8-10" />
    <circle cx="6" cy="18" r="1.6" />
    <circle cx="12" cy="14" r="1.6" />
    <circle cx="18" cy="7" r="1.6" />
  </>,
);
export const LibraryIcon = stroked(
  <>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </>,
);
export const SproutIcon = stroked(
  <>
    <path d="M12 21V11" />
    <path d="M12 13c-4 0-7-3-7-7 4 0 7 3 7 7z" />
    <path d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7z" />
  </>,
);
export const TeacherIcon = stroked(
  <>
    <path d="M3 9l9-5 9 5-9 5-9-5z" />
    <path d="M7 11v5c3 2 7 2 10 0v-5" />
  </>,
);
export const UserIcon = stroked(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  </>,
);
export const DownloadIcon = stroked(
  <>
    <path d="M12 4v11" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </>,
);
