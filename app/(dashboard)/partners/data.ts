export type PartnerFeature =
  | "Forex"
  | "Indices"
  | "Commodities"
  | "Stocks"
  | "Crypto"
  | "MT4"
  | "MT5"
  | "TradingView"
  | "Low spreads"
  | "Fast execution"
  | "Beginner friendly"
  | "Pro accounts"
  | "Regulated"
  | "Prop Firm"
  | "Metals"
  | "Futures";

export type PartnerBadge =
  | "Recommended"
  | "Best Execution"
  | "Sharp Pricing"
  | "Prop Firm";

export type PartnerCategory = "broker" | "prop" | "tools";

export type Partner = {
  slug: string;
  name: string;
  href: string;
  website?: string;
  description: string;
  features: PartnerFeature[];
  badges?: PartnerBadge[];
  highlight?: string;
  category?: PartnerCategory;
  highlightColor?: "emerald" | "amber";
  logo?: {
    src: string;
    alt: string;
  };
  perks?: Array<{
    title: string;
    items: string[];
  }>;
  priority?: number;
};

export const PARTNERS: Partner[] = [
  {
    slug: "blackbull",
    name: "BlackBull Markets",
    href: "https://blackbull.com/en/live-account/?cmp=5p0z2d3q&refid=5500",
    website: "https://blackbull.com",
    description:
      "A broker I recommend for traders who care about execution quality and tight pricing during liquid sessions.",
    features: [
      "Forex",
      "Indices",
      "Commodities",
      "Stocks",
      "MT4",
      "MT5",
      "Fast execution",
      "Low spreads",
    ],
    badges: ["Recommended", "Best Execution", "Sharp Pricing"],
    highlight: "Vacuum up these free goodies by signing up via my link.",
    highlightColor: "emerald",
    category: "broker",
    logo: { src: "/partners/blackbull.png", alt: "BlackBull Markets logo" },
    perks: [
      {
        title: "Sign Up Bonus",
        items: [
          "50% Deposit Bonus up to $1,000. For MT5 accounts only",
          "Example: Deposit $2,000 → receive $1,000 extra trading credit.",
        ],
      },
      {
        title: "Exclusive Prime Account Offer",
        items: [
          "Prime account usually requires a $2,000 minimum deposit.",
          "Available from £500 / $1,000 via referral (50–75% discount).",
          "Access tighter spreads at a discounted entry level.",
        ],
      },
      {
        title: "Free VPS Services",
        items: [
          "Reduced latency (up to 30%).",
          "99.999% uptime.",
          "Enhanced security & backups.",
          "Free with $2,000 deposit + 20 lots/month (otherwise $25 fee).",
          "I personally use this for auto trade management systems.",
        ],
      },
      {
        title: "Free TradingView Access",
        items: [
          "1 lot/month → Essential.",
          "5 lots/month → Plus.",
          "10 lots/month → Premium.",
        ],
      },
    ],
    priority: 100,
  },

  {
    slug: "magickeys",
    name: "MagicKeys",
    href: "https://magickeys.trade/haydosFX",
    website: "https://magickeys.trade",
    description:
      "Keyboard-driven trade execution and risk management. Designed to make execution faster, cleaner and rule-based.",
    features: ["MT4", "MT5", "Beginner friendly"],
    badges: ["Recommended"],
    highlight: "25% off with code HAYDOSFX_25 at checkout.",
    highlightColor: "amber",
    category: "tools",
    logo: { src: "/partners/MK.png", alt: "MagicKeys logo" },
    perks: [
      {
        title: "25% Off with My Code",
        items: [
          "Use code HAYDOSFX_25 for 25% off.",
          "Apply at checkout.",
        ],
      },
      {
        title: "Why I Recommend It",
        items: [
          "Open orders based on your risk parameters with automatic lot sizing.",
          "Break-even and partial take-profit automation.",
          "Quick position closing or preset SL/TP adjustments.",
          "Trading limits panel to prevent overtrading.",
          "Performance statistics by instrument.",
          "Trusted by 42,000+ traders.",
        ],
      },
    ],
    priority: 95,
  },

  {
    slug: "the5ers",
    name: "The5ers",
    href: "https://www.the5ers.com/?afmc=wv2",
    website: "https://www.the5ers.com",
    description:
      "A prop firm I recommend if you're taking challenges and want a structured pathway with clear rules and scaling models.",
    features: [
      "Forex",
      "Indices",
      "Metals",
      "Futures",
      "MT5",
      "Beginner friendly",
      "Prop Firm",
    ],
    badges: ["Recommended", "Prop Firm"],
    highlight: "Get 5% off any challenge when you sign up via my referral link.",
    highlightColor: "amber",
    category: "prop",
    logo: { src: "/partners/the5ers-2016.png", alt: "The5ers logo" },
    perks: [
      {
        title: "5% Off Challenges (via my link)",
        items: [
          "5% off any The5ers challenge purchase.",
          "Discount applied when you sign up through my referral link.",
          "If it doesn’t show, try incognito and re-open the link (cookie tracking).",
        ],
      },
    ],
    priority: 90,
  },
];