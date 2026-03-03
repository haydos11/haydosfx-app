import type { CuratedVideo } from "@/app/(dashboard)/learn/components/types";

export const learnStartHere = {
  title: "Core Foundations",
  subtitle:
    "If you're new here, start with these. Structure → Control → Session Liquidity. This is the framework behind everything else.",

  featured: {
    id: "BSqR0QUSaB8",
    title: "Support & Resistance — The Framework I Actually Use",
    description:
      "This is the foundation. How I mark levels, identify trapped traders, and understand where risk transfer is likely to happen.",
    level: "Beginner",
    duration: "Full session",
    tags: ["Start here", "Support/Resistance", "Liquidity"],
  } satisfies CuratedVideo,

  videos: [
    {
      id: "1bCgv18DRXY",
      title: "Market Structure: Who’s in Control & When It Actually Shifts",
      description:
        "Market structure isn’t about drawing zig-zags. It’s about understanding when buyers are defending, when sellers are pressing, and when control genuinely transfers. This is the foundation before liquidity and traps even make sense.",
      level: "Beginner",
      tags: ["Market Structure", "Control", "Bias"],
    },
    {
      id: "34K6tIuARGw",
      title:
        "Session Flow & Liquidity — Why Price Moves Between Asia, London & New York",
      description:
        "Price doesn’t move randomly between sessions. Each session inherits positioning, defends liquidity, or transfers risk. This breakdown explains why Asia sets context, London creates expansion, and New York resolves imbalance.",
      level: "Intermediate",
      tags: ["Sessions", "Liquidity", "Risk Transfer"],
    },
  ] satisfies CuratedVideo[],
};

export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@haydosfx";