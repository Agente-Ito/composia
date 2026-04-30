export default function ComposiaLogoHorizontal({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 48 32"
        xmlns="http://www.w3.org/2000/svg"
        className="w-9 h-6"
        aria-hidden="true"
      >
        {/* ── Left upper wing — large, rounded lobe ── */}
        <path
          d="M 24,16 C 22,8 10,3 5,12 C 3,18 12,22 24,16 Z"
          fill="#EDEFF6"
          fillOpacity="0.85"
        />
        {/* inner highlight — softer depth layer */}
        <path
          d="M 24,16 C 22,10 13,8 10,14 C 9,18 15,20 24,16 Z"
          fill="#EDEFF6"
          fillOpacity="0.35"
        />

        {/* ── Left lower wing — smaller, swept back ── */}
        <path
          d="M 24,16 C 19,21 11,25 13,29 C 15,31 22,28 24,16 Z"
          fill="#EDEFF6"
          fillOpacity="0.60"
        />

        {/* ── Right upper wing — mirror ── */}
        <path
          d="M 24,16 C 26,8 38,3 43,12 C 45,18 36,22 24,16 Z"
          fill="#EDEFF6"
          fillOpacity="0.85"
        />
        {/* inner highlight */}
        <path
          d="M 24,16 C 26,10 35,8 38,14 C 39,18 33,20 24,16 Z"
          fill="#EDEFF6"
          fillOpacity="0.35"
        />

        {/* ── Right lower wing — mirror ── */}
        <path
          d="M 24,16 C 29,21 37,25 35,29 C 33,31 26,28 24,16 Z"
          fill="#EDEFF6"
          fillOpacity="0.60"
        />

        {/* ── Nucleus ── */}
        <circle cx="24" cy="16" r="4"   fill="#7B61FF" fillOpacity="0.18" />
        <circle cx="24" cy="16" r="2.2" fill="#7B61FF" />
      </svg>

      <span
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 500,
          fontSize: "0.9375rem",
          color: "#EDEFF6",
          letterSpacing: "0.02em",
        }}
      >
        Composia
      </span>
    </div>
  );
}
