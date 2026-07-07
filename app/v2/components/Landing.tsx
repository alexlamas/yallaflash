"use client";

import Image from "next/image";
import posthog from "posthog-js";
import { ArrowRight, Camera, PencilLine, TreePine } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { PublicFooter } from "@/app/components/PublicFooter";

// V2 landing: memory-app positioning ("remember words from real life"),
// replacing the course-style "Learn Lebanese Arabic" pitch. The hero phone
// mirrors the actual /chat experience so the ad promise and the product
// are the same picture.
export function LandingV2() {
  const { setShowAuthDialog } = useAuth();

  const handleCtaClick = (location: string) => {
    posthog.capture("signup_cta_clicked", { location });
    setShowAuthDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/80 via-white to-green-50/40 text-stone-900">
      {/* Nav */}
      <header className="max-w-6xl mx-auto flex items-center gap-3 px-6 pt-6">
        <Image src="/logo.svg" alt="Yalla" width={30} height={30} />
        <span className="font-title text-2xl font-bold">Yalla</span>
        <nav className="ml-auto flex items-center gap-5 text-sm text-stone-500">
          <a href="#how" className="hidden sm:block hover:text-stone-900 transition-colors">
            How it works
          </a>
          <button onClick={() => handleCtaClick("nav_login")} className="hover:text-stone-900 transition-colors">
            Log in
          </button>
          <button
            onClick={() => handleCtaClick("nav")}
            className="rounded-full bg-stone-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-stone-800 transition-colors"
          >
            Get started
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center px-6 pt-16 pb-20 lg:pt-24">
        <div>
          <h1 className="font-title text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight">
            Remember every word <em className="not-italic text-green-700">you</em> hear.
          </h1>
          <p className="mt-6 text-lg sm:text-xl leading-relaxed text-stone-600 max-w-xl">
            Yalla is a memory app with an AI tutor. <b className="text-stone-900">Text it a word, photo a menu,</b> and
            it quizzes you right before you&apos;d forget — so words from real life actually stick.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button
              onClick={() => handleCtaClick("hero")}
              className="rounded-full bg-green-700 text-white px-8 py-4 text-lg font-semibold shadow-lg shadow-green-700/25 hover:bg-green-800 transition-colors"
            >
              Start remembering
            </button>
            <a href="#how" className="inline-flex items-center gap-1.5 text-stone-700 font-medium hover:text-stone-900">
              See a session <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-mono tracking-[0.15em] text-stone-600 uppercase mr-1">Works for</span>
            <span className="rounded-full border border-green-600 bg-green-50 px-4 py-1.5 text-sm font-semibold text-green-900">
              Lebanese Arabic
            </span>
            {["Spanish", "People's names", "Anything you keep forgetting"].map((label) => (
              <span
                key={label}
                className="rounded-full border border-dashed border-stone-300 px-4 py-1.5 text-sm text-stone-500"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Phone mockup mirroring /chat */}
        <div aria-hidden="true" className="flex justify-center lg:justify-end">
          <div className="w-[330px] rounded-[42px] border border-stone-200 bg-white p-3.5 shadow-2xl shadow-stone-900/20">
            <div className="rounded-[30px] overflow-hidden bg-gradient-to-b from-green-50 to-white flex flex-col min-h-[560px]">
              <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
                <div className="h-6 w-6 rounded-full bg-white border border-stone-200" />
                <div className="relative flex-1 h-1.5 rounded-full bg-stone-200">
                  <div className="absolute inset-y-0 left-0 w-[55%] rounded-full bg-green-600" />
                </div>
                <div className="rounded-full bg-white border border-stone-200 px-2.5 py-1 text-[11px] font-semibold text-green-900 whitespace-nowrap">
                  3 due
                </div>
              </div>
              <div className="flex-1 px-3.5 py-3 flex flex-col gap-2.5">
                <div className="self-end max-w-[80%] rounded-2xl rounded-br-md bg-green-700 px-3.5 py-2.5 text-[13px] text-white">
                  my mother in law said &quot;ktir zaki&quot; about dinner
                </div>
                <div className="self-start max-w-[85%] rounded-2xl rounded-bl-md bg-white border border-stone-200 px-3.5 py-2.5 text-[13px] text-stone-600">
                  Nice — <b className="text-stone-900">zaki</b> = delicious. Saved it with that story. She&apos;ll say
                  it again; next time you&apos;ll catch it.
                </div>
                <div className="relative mt-1.5 mx-0.5">
                  <div className="absolute inset-0 translate-x-[5px] translate-y-[6px] rounded-2xl border border-stone-200 bg-white opacity-50" />
                  <div className="absolute inset-0 translate-x-[2px] translate-y-[3px] rounded-2xl border border-stone-200 bg-white opacity-75" />
                  <div className="relative rounded-2xl border border-stone-200 bg-white px-4 py-5 text-center">
                    <div className="font-title text-3xl" dir="rtl">
                      كتير
                    </div>
                    <div className="mt-2 text-sm text-stone-500">What does &quot;ktir&quot; mean?</div>
                    <div className="mt-3.5 grid gap-1.5 text-[13px]">
                      <div className="rounded-lg border border-green-600 bg-green-50 py-2 font-semibold">
                        a lot / very
                      </div>
                      <div className="rounded-lg border border-stone-200 py-2">slowly</div>
                      <div className="rounded-lg border border-stone-200 py-2">tomorrow</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mx-3 mb-3.5 flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2.5 text-[13px] text-stone-400">
                <Camera className="h-4 w-4" />
                Message your tutor...
                <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white">
                  <ArrowRight className="h-3.5 w-3.5 -rotate-90" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capture -> recall -> keep */}
      <section id="how" className="max-w-6xl mx-auto px-6 pb-24">
        <div className="mb-12">
          <div className="text-xs font-mono tracking-[0.18em] text-green-700 uppercase">
            The three moments that matter
          </div>
          <h2 className="font-title text-4xl sm:text-5xl mt-3">Capture &rarr; recall &rarr; keep</h2>
          <p className="mt-4 text-lg text-stone-600 max-w-2xl leading-relaxed">
            Life gives you a word, you toss it to the tutor in seconds, the app owns the remembering.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          <div>
            <div aria-hidden="true" className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Camera className="h-4 w-4 text-green-700" /> Found 3 words in your photo
              </div>
              <div className="mt-3 divide-y divide-stone-100 text-sm">
                {[
                  ["mashewe", "مشاوي", "grilled meats"],
                  ["batata", "بطاطا", "potatoes"],
                  ["toum", "توم", "garlic sauce"],
                ].map(([arabizi, script, english]) => (
                  <div key={arabizi} className="flex justify-between py-2">
                    <span>
                      <b>{arabizi}</b>{" "}
                      <span dir="rtl" className="text-stone-700">
                        {script}
                      </span>
                    </span>
                    <span className="text-stone-500">{english}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-green-700 py-2.5 text-center text-sm font-semibold text-white">
                Confirm and add
              </div>
            </div>
            <h3 className="font-title text-2xl mt-5">Capture without friction</h3>
            <p className="mt-2 text-stone-600 leading-relaxed">
              Photo a menu, paste what you heard, or just tell the tutor. Context goes into the word&apos;s notes
              automatically.
            </p>
          </div>
          <div>
            <div aria-hidden="true" className="rounded-2xl border border-stone-200 bg-white p-5 text-center">
              <div className="font-title text-3xl" dir="rtl">
                زكي
              </div>
              <div className="mt-2 text-sm text-stone-500">Type the arabizi — from memory.</div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11.5px] text-amber-800">
                <PencilLine className="h-3 w-3" /> You heard this from your mother-in-law about dinner
              </div>
              <div className="mt-3 rounded-lg border border-stone-200 px-3 py-2 text-left text-sm text-stone-400">
                zaki|
              </div>
            </div>
            <h3 className="font-title text-2xl mt-5">Recall with your own story</h3>
            <p className="mt-2 text-stone-600 leading-relaxed">
              Cards carry the moment you met the word. Personal context is the strongest memory hook there is — the
              tutor writes it down so you don&apos;t have to.
            </p>
          </div>
          <div>
            <div aria-hidden="true" className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="text-[11px] font-mono tracking-[0.15em] text-stone-600">MEMORY TELEMETRY</div>
              <div className="mt-1 font-title text-4xl text-green-900">
                142 <span className="text-base font-sans text-stone-500">words kept</span>
              </div>
              <div className="mt-3 flex h-16 items-end justify-around rounded-xl bg-gradient-to-b from-green-50 to-green-100 px-2 pb-2">
                {[1, 0.6, 1, 0.8, 0.5, 1, 0.6, 0.9, 0.5].map((scale, i) => (
                  <TreePine
                    key={i}
                    className="text-green-600"
                    style={{ height: `${28 * scale}px`, width: `${28 * scale}px` }}
                  />
                ))}
              </div>
              <div className="mt-3 flex justify-between font-mono text-[11.5px] text-stone-500">
                <span>RETENTION 91%</span>
                <span className="font-bold text-red-600">4 DUE NOW</span>
                <span>T&minus;02:14:09</span>
              </div>
            </div>
            <h3 className="font-title text-2xl mt-5">Keep it, provably</h3>
            <p className="mt-2 text-stone-600 leading-relaxed">
              Your forest grows as words survive longer intervals. The countdown says exactly when memory needs you
              next — five minutes on the bus is enough.
            </p>
          </div>
        </div>

        <div className="mt-20 rounded-3xl bg-green-900 px-8 py-14 text-center text-white">
          <h2 className="font-title text-3xl sm:text-4xl">Stop losing the words life gives you.</h2>
          <button
            onClick={() => handleCtaClick("footer")}
            className="mt-7 rounded-full bg-white px-8 py-4 text-lg font-semibold text-green-900 hover:bg-green-50 transition-colors"
          >
            Start remembering — it&apos;s free
          </button>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
