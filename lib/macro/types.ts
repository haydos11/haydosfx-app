export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "CHF" | "NZD"

export type CotData = {
  currency: CurrencyCode
  netPosition: number
  changeWoW: number
  percentile: number
}

export type PriceContext = {
  pair: string
  lastPrice: number
  trend: "bullish" | "bearish" | "neutral"
}

export type EconomicIndicator = {
  name: string
  value: number
  change: number
}

export type CalendarEvent = {
  title: string
  country: string
  importance: number
  time: string
}

export type MacroContext = {
  pair: string
  base: CurrencyCode
  quote: CurrencyCode
  cot: CotData[]
  price: PriceContext
  indicators: EconomicIndicator[]
  events: CalendarEvent[]
}