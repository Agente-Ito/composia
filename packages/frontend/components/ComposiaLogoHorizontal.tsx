export default function ComposiaLogoHorizontal({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/*
        Butterfly reconstructed from brand guide §1 horizontal version.
        ViewBox 56×40, center (28, 20).
        4 wing pairs — upper dominant, lower swept back.
        Pure fills, no strokes, no nodes.
      */}
      <svg
        viewBox="0 0 56 40"
        xmlns="http://www.w3.org/2000/svg"
        className="w-10 h-7"
        aria-hidden="true"
      >
        {/* ── Upper-left wing — primary fill ── */}
        <path
          d="M 28,20 C 25,11 14,4 7,11 C 4,17 11,23 28,20 Z"
          fill="#EDEFF6"
          fillOpacity="0.88"
        />
        {/* depth layer — inner rounded lobe */}
        <path
          d="M 28,20 C 25,13 17,9 13,15 C 11,19 16,22 28,20 Z"
          fill="#EDEFF6"
          fillOpacity="0.38"
        />

        {/* ── Upper-right wing — primary fill ── */}
        <path
          d="M 28,20 C 31,11 42,4 49,11 C 52,17 45,23 28,20 Z"
          fill="#EDEFF6"
          fillOpacity="0.88"
        />
        {/* depth layer */}
        <path
          d="M 28,20 C 31,13 39,9 43,15 C 45,19 40,22 28,20 Z"
          fill="#EDEFF6"
          fillOpacity="0.38"
        />

        {/* ── Lower-left wing — smaller, swept back ── */}
        <path
          d="M 28,20 C 22,25 13,29 15,34 C 17,37 25,34 28,20 Z"
          fill="#EDEFF6"
          fillOpacity="0.62"
        />

        {/* ── Lower-right wing — mirror ── */}
        <path
          d="M 28,20 C 34,25 43,29 41,34 C 39,37 31,34 28,20 Z"
          fill="#EDEFF6"
          fillOpacity="0.62"
        />

        {/* ── Nucleus ── */}
        <circle cx="28" cy="20" r="4.5" fill="#7B61FF" fillOpacity="0.20" />
        <circle cx="28" cy="20" r="2.4" fill="#7B61FF" />
      </svg>

      <span
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 500,
          fontSize: "0.9375rem",
          color: "#EDEFF6",
          letterSpacing: "0.01em",
        }}
      >
        Composia
      </span>
    </div>
  );
}
