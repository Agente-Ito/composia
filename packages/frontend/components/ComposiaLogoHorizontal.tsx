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
        className="w-9 h-7"
      >
        <path
          d="M24 16 C20 6, 8 6, 6 14 C10 14, 14 18, 18 20 C14 20, 10 24, 8 28 C14 26, 20 22, 24 16 Z"
          fill="#EDEFF6"
          fillOpacity="0.85"
        />
        <path
          d="M24 16 C20 10, 10 10, 8 16 C12 16, 16 18, 20 19"
          fill="#EDEFF6"
          fillOpacity="0.4"
        />
        <path
          d="M24 16 C28 6, 40 6, 42 14 C38 14, 34 18, 30 20 C34 20, 38 24, 40 28 C34 26, 28 22, 24 16 Z"
          fill="#EDEFF6"
          fillOpacity="0.85"
        />
        <path
          d="M24 16 C28 10, 38 10, 40 16 C36 16, 32 18, 28 19"
          fill="#EDEFF6"
          fillOpacity="0.4"
        />
        <circle cx="24" cy="16" r="2.2" fill="#7B61FF" />
        <circle cx="24" cy="16" r="4" fill="#7B61FF" fillOpacity="0.15" />
      </svg>

      <span className="font-sora text-base font-medium tracking-wide text-white">
        Composia
      </span>
    </div>
  );
}
