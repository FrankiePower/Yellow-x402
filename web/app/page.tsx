import GridBackground from "./components/GridBackground";
import Header from "./components/Header";
import Link from "next/link";

export default function Home() {
  return (
    <div className="h-screen overflow-hidden bg-black text-white font-sans selection:bg-white/15 cursor-default flex flex-col">
      <GridBackground />

      <Header showConnectWallet={false} />

      <main className="relative z-10 flex-1 flex items-center px-6 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col gap-12 md:gap-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-end">
              <div className="lg:col-span-8 flex flex-col gap-4 md:gap-6">
                <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-4">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white"></div>
                  <div className="h-px w-8 md:w-12 bg-white/40"></div>
                  <span className="text-[9px] md:text-[10px] tracking-[0.3em] uppercase font-mono text-[#FCD535]/80">
                    Yellow X402 Payments
                  </span>
                </div>

                <h1 className="text-[4rem] sm:text-[6rem] md:text-[9rem] lg:text-[11rem] font-bold leading-[0.8] tracking-[-0.05em] text-[#FCD535]">
                  YELLOW
                  <span className="block text-white ml-1 md:ml-2 lg:ml-4">
                    402
                  </span>
                </h1>
              </div>

              <div className="lg:col-span-4 flex flex-col justify-end pb-2 md:pb-4 gap-4 md:gap-6">
                <div className="space-y-3 md:space-y-4 border-l border-white/20 pl-6 md:pl-8">
                  <p className="text-base md:text-xl text-white leading-relaxed font-light">
                    Enabling agents to reach any X402 sellers from any chain
                    through an OFT using custom EIP-3009.
                  </p>
                  <p className="text-xs md:text-sm text-white/60 leading-relaxed font-mono">
                    // Built on LayerZero OFT with USDO backed 1:1 by USDC.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:gap-6">
              <Link href="/build" className="w-full sm:w-auto">
                <button className="group relative w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-black border border-white text-white overflow-hidden cursor-pointer">
                  <div className="absolute inset-0 bg-white -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></div>
                  <span className="relative z-10 text-xs md:text-sm font-bold tracking-[0.15em] group-hover:text-black transition-colors duration-300 flex items-center justify-center gap-3">
                    START BUILDING
                    <svg
                      className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </span>
                </button>
              </Link>

              <a
                href="https://ethglobal.com/showcase/omnix402-hkrwm"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <button className="group relative w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-black border border-white text-white overflow-hidden cursor-pointer">
                  <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                  <span className="relative z-10 text-xs md:text-sm font-bold tracking-[0.15em] group-hover:text-black transition-colors duration-300">
                    VIEW ETHGLOBAL SHOWCASE
                  </span>
                </button>
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-50 bg-linear-to-t from-black via-black/95 to-transparent border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-[9px] md:text-[10px] tracking-[0.2em] uppercase font-mono text-white/40">
                v1.0.0
              </span>
            </div>
            <div className="flex items-center gap-4 md:gap-6 text-[9px] md:text-[10px] tracking-[0.2em] uppercase font-mono text-white/40">
              <a
                href="https://github.com/0xKairn/Omnix402"
                className="hover:text-white transition-colors cursor-pointer"
              >
                GitHub
              </a>
              <a
                href="#"
                className="hover:text-white transition-colors cursor-pointer"
              >
                Documentation
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
