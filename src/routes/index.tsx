import { createFileRoute } from "@tanstack/react-router";
import PhaserGame from "../components/PhaserGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardi — The Kenyan Card Game" },
      { name: "description", content: "Play Cardi, a Kenyan-inspired shedding card game, against the Mzalendo bot." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-background">
      <PhaserGame />
    </main>
  );
}