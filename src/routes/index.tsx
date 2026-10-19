import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardi — The Kenyan Card Game" },
      { name: "description", content: "Play Cardi, a Kenyan-inspired shedding card game, against the Mzalendo bot." },
      { property: "og:title", content: "Cardi — The Kenyan Card Game" },
      { property: "og:description", content: "Kickback, Jump, Foul and wild Aces. Shout Niko Cardi and empty your hand first!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-background">
      <iframe
        src="/cardi/index.html"
        title="Cardi card game"
        className="h-full w-full border-0"
      />
    </main>
  );
}
