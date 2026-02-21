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
  | "Regulated";

export type PartnerBadge = "Recommended" | "Best Execution" | "Sharp Pricing";

export type Partner = {
  slug: string;
  name: string;
  href: string; // referral link
  website?: string; // non-ref link
  description: string;
  features: PartnerFeature[];
  badges?: PartnerBadge[];
  highlight?: string;
  logo?: {
    src: string; // /public/partners/...
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
    logo: { src: "/partners/blackbull.png", alt: "BlackBull Markets logo" },
    perks: [
      {
        title: "Sign Up Bonus",
        items: [
          "50% Deposit Bonus up to $1,000.",
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
];