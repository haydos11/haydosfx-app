export type CbMeta = {
  cb_code: string;      // e.g. 'FED'
  country: string;      // e.g. 'United States'
  currency: string;     // e.g. 'USD'
  aliases: string[];    // possible names in calendars
  ffCountry: string[];  // ForexFactory country codes to match
  myfxCountry: string[];// Myfxbook country tags to match
};

export const CBANKS: Record<string, CbMeta> = {
  US: { cb_code: "FED", country: "United States", currency: "USD",
    aliases: ["Federal Reserve","FOMC","Fed Funds Rate","Federal Funds Rate","Fed Interest Rate"],
    ffCountry: ["USD"], myfxCountry: ["USD"]
  },
  EU: { cb_code: "ECB", country: "Euro Area", currency: "EUR",
    aliases: ["ECB","Main Refinancing Rate","Deposit Facility Rate","Interest Rate Decision (ECB)"],
    ffCountry: ["EUR"], myfxCountry: ["EUR"]
  },
  GB: { cb_code: "BOE", country: "United Kingdom", currency: "GBP",
    aliases: ["Bank of England","Official Bank Rate","BoE Rate Decision"],
    ffCountry: ["GBP"], myfxCountry: ["GBP"]
  },
  JP: { cb_code: "BOJ", country: "Japan", currency: "JPY",
    aliases: ["Bank of Japan","Policy Rate Balance","BoJ Interest Rate Decision"],
    ffCountry: ["JPY"], myfxCountry: ["JPY"]
  },
  CH: { cb_code: "SNB", country: "Switzerland", currency: "CHF",
    aliases: ["Swiss National Bank","SNB Policy Rate","Interest Rate Decision (SNB)"],
    ffCountry: ["CHF"], myfxCountry: ["CHF"]
  },
  CA: { cb_code: "BOC", country: "Canada", currency: "CAD",
    aliases: ["Bank of Canada","Overnight Rate Target","BoC Interest Rate Decision"],
    ffCountry: ["CAD"], myfxCountry: ["CAD"]
  },
  AU: { cb_code: "RBA", country: "Australia", currency: "AUD",
    aliases: ["Reserve Bank of Australia","Cash Rate Target","RBA Interest Rate Decision"],
    ffCountry: ["AUD"], myfxCountry: ["AUD"]
  },
  NZ: { cb_code: "RBNZ", country: "New Zealand", currency: "NZD",
    aliases: ["Reserve Bank of New Zealand","Official Cash Rate","RBNZ Interest Rate Decision"],
    ffCountry: ["NZD"], myfxCountry: ["NZD"]
  },
  CN: { cb_code: "PBOC", country: "China", currency: "CNY",
    aliases: ["People's Bank of China","Loan Prime Rate","MLF Rate","PBoC Rate Decision"],
    ffCountry: ["CNY"], myfxCountry: ["CNY"]
  },
};

export const DEFAULT_CODES = ["US","EU","GB","JP","CH","CA","AU","NZ","CN"];

export type LiveRate = {
  cb_code: string;
  country: string;
  currency: string;
  current: number | null;       // actual if published
  previous: number | null;
  forecast: number | null;
  released_at: string | null;   // ISO time of event
  next_meeting: string | null;  // if available
  source: "myfxbook" | "forexfactory";
};
