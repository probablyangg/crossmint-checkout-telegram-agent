import Image from "next/image";
import { HomeContent } from "@/app/home";

export default function Home() {
  return (
    <div className="grid h-screen items-center">
      <main className="row-start-2 flex h-full flex-col items-center gap-8 sm:items-start">
        <HomeContent />
      </main>
      <footer className="row-start-3 mb-4 flex flex-col items-center justify-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a
            className="flex items-center gap-2 hover:underline hover:underline-offset-4"
            href="https://github.com/Crossmint/fintech-starter-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image aria-hidden src="/file.svg" alt="File icon" width={16} height={16} />
            View code
          </a>
          <a
            className="flex items-center gap-2 hover:underline hover:underline-offset-4"
            href="https://crossmint.com/quickstarts"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image aria-hidden src="/window.svg" alt="Window icon" width={16} height={16} />
            See all quickstarts
          </a>
          <a
            className="flex items-center gap-2 hover:underline hover:underline-offset-4"
            href="https://crossmint.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image aria-hidden src="/globe.svg" alt="Globe icon" width={16} height={16} />
            Go to crossmint.com →
          </a>
        </div>
        <div className="flex">
          <Image
            src="/crossmint-leaf.svg"
            alt="Powered by Crossmint"
            priority
            width={152}
            height={100}
          />
        </div>
      </footer>
    </div>
  );
}
