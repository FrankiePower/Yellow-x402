"use client";

import Header from "../components/Header";
import Footer from "../components/Footer";
import HowItWorks from "./components/HowItWorks";
import CodeExample from "./components/CodeExample";
import YellowDemo from "./components/YellowDemo";
import ChannelManagement from "./components/ChannelManagement";
import Image from "next/image";

export default function Build() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Header showConnectWallet={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12">
        <div className="space-y-16 md:space-y-24">
          <section className="mb-12 md:mb-20">
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight tracking-tight mb-3 md:mb-4">
              Instant Micropayments
              <br />
              with Yellow Network
            </h1>
            <p className="text-2xl sm:text-3xl lg:text-4xl text-white/50 font-light">
              Gas-Free x402 Payments for AI Agents
            </p>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            <div className="lg:col-span-8">
              <h2 className="text-xs md:text-sm font-mono text-white/40 uppercase tracking-widest mb-4 md:mb-6">
                Integration Example
              </h2>
              <CodeExample />
            </div>

            <div className="lg:col-span-4">
              <HowItWorks />
            </div>
          </section>

          <section className="max-w-5xl mx-auto">
            <h2 className="text-xs md:text-sm font-mono text-white/40 uppercase tracking-widest mb-4 md:mb-6 text-center">
              Live Demo - Full State Channel Flow
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChannelManagement />
              <YellowDemo />
            </div>
          </section>

          <section className="flex flex-col items-center">
            <h2 className="text-xs md:text-sm font-mono text-white/40 uppercase tracking-widest mb-4 md:mb-6 text-center">
              Detailed Workflow
            </h2>
            <div className="w-full max-w-5xl bg-white/5 border border-white/10 p-2 md:p-4 mb-16 md:mb-24">
              <Image
                src="/assets/workflow.png"
                alt="Omnix402 Workflow"
                width={1200}
                height={800}
                className="w-full h-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
                priority
              />
            </div>
          </section>

          <section className="flex flex-col items-center max-w-3xl mx-auto text-center border-t border-white/10 pt-12 md:pt-16">
            <h2 className="text-xs md:text-sm font-mono text-white/40 uppercase tracking-widest mb-3 md:mb-4">
              Need Help?
            </h2>
            <p className="text-sm md:text-base text-white/60 mb-4 md:mb-6 px-4">
              Don't hesitate to contact us if you have any issues or questions
              about the implementation.
            </p>
            <a
              href="https://t.me/looper_d3v"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all text-white text-sm md:text-base"
            >
              <svg
                className="w-4 h-4 md:w-5 md:h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.098.155.231.171.324.016.093.036.305.02.469z" />
              </svg>
              <span className="font-mono text-xs md:text-sm">@looper_d3v</span>
            </a>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
