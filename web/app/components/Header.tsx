"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "./Logo";
import { NetworkButton } from "./NetworkButton";
import { ConnectButton } from "./ConnectButton";
import SwapUSDO from "./SwapUSDO";

interface HeaderProps {
  showConnectWallet?: boolean;
}

export default function Header({ showConnectWallet = false }: HeaderProps) {
  const [isSwapOpen, setIsSwapOpen] = useState(false);

  return (
    <>
      <nav className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 h-16 md:h-20 flex justify-between items-center">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="text-xl md:text-2xl font-black tracking-tighter text-[#FCD535]">
              YELLOW
            </span>
            <span className="text-sm md:text-base font-mono text-white/60 tracking-widest">
              X402
            </span>
          </Link>

          <div className="flex justify-end items-center gap-2 md:gap-6">
            {showConnectWallet && (
              <>
                <button
                  onClick={() => setIsSwapOpen(true)}
                  className="group relative px-3 md:px-4 py-1.5 md:py-2 border border-white/20 hover:border-white text-white text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <span className="absolute inset-0 bg-white -translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></span>
                  <span className="relative z-10 group-hover:text-black transition-colors duration-300">
                    Get USDO
                  </span>
                </button>
                <div className="hidden md:block h-5 w-px bg-white/10"></div>
                <div className="hidden md:block">
                  <NetworkButton />
                </div>
                <ConnectButton />
              </>
            )}
            {!showConnectWallet && (
              <>

                <Link
                  href="https://github.com/FrankiePower/Yellow-x402"
                  target="_blank"
                  className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider md:tracking-widest text-white/60 hover:text-white transition-colors cursor-pointer group"
                >
                  <svg
                    className="w-4 h-4 md:w-4 md:h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span className="hidden sm:inline">GitHub</span>
                </Link>
                <Link href="/build">
                  <button className="relative px-4 md:px-6 py-1.5 md:py-2 bg-white text-black text-[10px] md:text-xs font-bold uppercase tracking-wider transition-transform duration-300 hover:scale-105 border border-white cursor-pointer ml-2 md:ml-4">
                    <span className="relative z-10">Launch App</span>
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Swap Modal */}
      {isSwapOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setIsSwapOpen(false)}
              className="absolute -top-12 right-0 text-white/60 hover:text-white text-xs uppercase tracking-widest"
            >
              Close [X]
            </button>
            <SwapUSDO />
          </div>
        </div>
      )}
    </>
  );
}
