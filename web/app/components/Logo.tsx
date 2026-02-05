export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dimensions = {
    sm: { svg: 32, text: "text-sm", code: "text-[10px]" },
    md: { svg: 40, text: "text-base", code: "text-xs" },
    lg: { svg: 52, text: "text-xl", code: "text-sm" },
  };

  const d = dimensions[size];

  return (
    <div className="flex items-center gap-3 select-none">
      <svg
        width={d.svg}
        height={d.svg}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="50" r="8" fill="white" />

        <line
          x1="50"
          y1="42"
          x2="50"
          y2="15"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="58"
          y1="50"
          x2="85"
          y2="50"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="58"
          x2="50"
          y2="85"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="42"
          y1="50"
          x2="15"
          y2="50"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <line
          x1="56"
          y1="44"
          x2="75"
          y2="25"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="56"
          y1="56"
          x2="75"
          y2="75"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="44"
          y1="56"
          x2="25"
          y2="75"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="44"
          y1="44"
          x2="25"
          y2="25"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />

        <circle cx="50" cy="15" r="3" fill="white" />
        <circle cx="85" cy="50" r="3" fill="white" />
        <circle cx="50" cy="85" r="3" fill="white" />
        <circle cx="15" cy="50" r="3" fill="white" />

        <circle cx="75" cy="25" r="2.5" fill="white" />
        <circle cx="75" cy="75" r="2.5" fill="white" />
        <circle cx="25" cy="75" r="2.5" fill="white" />
        <circle cx="25" cy="25" r="2.5" fill="white" />
      </svg>

      <div className="flex items-baseline gap-1">
        <span className={`${d.text} font-black tracking-tighter`}>OMNIX</span>
        <span className={`${d.code} font-mono text-white/60 tracking-widest`}>
          402
        </span>
      </div>
    </div>
  );
}
