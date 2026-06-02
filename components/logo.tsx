export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="512" height="512" rx="96" fill="#1f3d2b" />
        <circle cx="198" cy="248" r="20" fill="#b8842a" />
        <circle cx="256" cy="220" r="20" fill="#b8842a" />
        <circle cx="314" cy="248" r="20" fill="#b8842a" />
        <clipPath id="pill">
          <rect x="156" y="290" width="200" height="72" rx="36" />
        </clipPath>
        <g clipPath="url(#pill)">
          <rect x="156" y="290" width="100" height="72" fill="#faf6ef" />
          <rect x="256" y="290" width="100" height="72" fill="#b8842a" />
        </g>
        <rect x="156" y="290" width="200" height="72" rx="36" fill="none" stroke="#faf6ef" strokeWidth="5" />
        <line x1="256" y1="290" x2="256" y2="362" stroke="#1f3d2b" strokeWidth="5" />
      </svg>
      <span className="font-display font-semibold text-forest text-lg leading-tight">
        Carico<br />Farmacia
      </span>
    </div>
  );
}
