export type DomainDefinition = {
  name: string;
  members: string;
  icon: string;
};

export type DomainCategory = {
  name: string;
  domains: DomainDefinition[];
};

export const CALIBRATING_DOMAIN = "calibrating";
export const GENERAL_DOMAIN = "general";

export const domainCategories: DomainCategory[] = [
  {
    name: "General / interdisciplinary",
    domains: [{ name: GENERAL_DOMAIN, members: "all", icon: "G" }],
  },
  {
    name: "Formal / abstract",
    domains: [
      { name: "logic", members: "420k", icon: "L" },
      { name: "mathematics", members: "1.1m", icon: "Ma" },
      { name: "statistics", members: "890k", icon: "S" },
      { name: "computer-science", members: "2.1m", icon: "CS" },
      { name: "systems-theory", members: "180k", icon: "ST" },
      { name: "game-theory", members: "340k", icon: "GT" },
      { name: "information-theory", members: "220k", icon: "IT" },
    ],
  },
  {
    name: "Physical sciences",
    domains: [
      { name: "physics", members: "1.4m", icon: "Ph" },
      { name: "astronomy", members: "620k", icon: "As" },
      { name: "chemistry", members: "980k", icon: "Ch" },
      { name: "earth-science", members: "410k", icon: "ES" },
      { name: "climate-science", members: "320k", icon: "Cl" },
      { name: "materials-science", members: "410k", icon: "MS" },
    ],
  },
  {
    name: "Engineering / applied",
    domains: [
      { name: "engineering", members: "1.5m", icon: "E" },
      { name: "electrical-engineering", members: "780k", icon: "EE" },
      { name: "mechanical-engineering", members: "650k", icon: "ME" },
      { name: "software-engineering", members: "1.8m", icon: "SE" },
      { name: "robotics", members: "920k", icon: "R" },
      { name: "artificial-intelligence", members: "1.3m", icon: "AI" },
      { name: "machine-learning", members: "1.0m", icon: "ML" },
    ],
  },
  {
    name: "Life & health",
    domains: [
      { name: "biology", members: "1.4m", icon: "B" },
      { name: "medicine", members: "1.2m", icon: "M" },
      { name: "neuroscience", members: "560k", icon: "N" },
      { name: "psychology", members: "1.4m", icon: "P" },
      { name: "genetics", members: "480k", icon: "G" },
      { name: "ecology", members: "390k", icon: "Ec" },
      { name: "epidemiology", members: "310k", icon: "Ep" },
    ],
  },
  {
    name: "Social sciences",
    domains: [
      { name: "economics", members: "1.1m", icon: "E" },
      { name: "political-science", members: "620k", icon: "PS" },
      { name: "sociology", members: "450k", icon: "S" },
      { name: "anthropology", members: "380k", icon: "A" },
      { name: "human-geography", members: "290k", icon: "HG" },
      { name: "international-relations", members: "410k", icon: "IR" },
    ],
  },
  {
    name: "Humanities",
    domains: [
      { name: "philosophy", members: "890k", icon: "Ph" },
      { name: "ethics", members: "520k", icon: "E" },
      { name: "history", members: "1.3m", icon: "H" },
      { name: "linguistics", members: "470k", icon: "Lg" },
      { name: "literature", members: "760k", icon: "Li" },
      { name: "religious-studies", members: "340k", icon: "RS" },
    ],
  },
  {
    name: "Law & governance",
    domains: [
      { name: "law", members: "680k", icon: "L" },
      { name: "constitutional-law", members: "210k", icon: "CL" },
      { name: "international-law", members: "280k", icon: "IL" },
      { name: "public-policy", members: "360k", icon: "PP" },
      { name: "regulation", members: "190k", icon: "R" },
    ],
  },
  {
    name: "Creative & symbolic",
    domains: [
      { name: "art", members: "1.6m", icon: "A" },
      { name: "music", members: "2.3m", icon: "M" },
      { name: "architecture", members: "540k", icon: "Ar" },
      { name: "design", members: "1.1m", icon: "D" },
      { name: "aesthetics", members: "260k", icon: "Ae" },
    ],
  },
  {
    name: "Meta / reflexive",
    domains: [
      { name: "metaphysics", members: "310k", icon: "Mp" },
      { name: "epistemology", members: "240k", icon: "Ep" },
      { name: "ontology", members: "190k", icon: "O" },
      { name: "science-studies", members: "170k", icon: "SS" },
      { name: "methodology", members: "280k", icon: "Me" },
    ],
  },
];

export const domainOptions = domainCategories.flatMap((category) =>
  category.domains.map((domain) => domain.name)
);

const canonicalDomainSet = new Set(domainOptions);

const directDomainAliases = new Map<string, string>([
  ["computer_science", "computer-science"],
  ["computing", "computer-science"],
  ["informatics", "computer-science"],
  ["ai", "artificial-intelligence"],
  ["agi", "artificial-intelligence"],
  ["alignment", "artificial-intelligence"],
  ["ai-alignment", "artificial-intelligence"],
  ["language-models", "artificial-intelligence"],
  ["large-language-models", "artificial-intelligence"],
  ["foundation-models", "artificial-intelligence"],
  ["llm", "artificial-intelligence"],
  ["llms", "artificial-intelligence"],
  ["machine-intelligence", "artificial-intelligence"],
  ["multi-agent-systems", "artificial-intelligence"],
  ["multi-agent-governance", "artificial-intelligence"],
  ["ml", "machine-learning"],
  ["deep-learning", "machine-learning"],
  ["reinforcement-learning", "machine-learning"],
  ["neural-networks", "machine-learning"],
  ["statistical-learning", "machine-learning"],
  ["astrophysics", "astronomy"],
  ["planetary-science", "astronomy"],
  ["cosmology", "astronomy"],
  ["space-science", "astronomy"],
  ["exoplanet-science", "astronomy"],
  ["geology", "earth-science"],
  ["geophysics", "earth-science"],
  ["geoscience", "earth-science"],
  ["meteorology", "climate-science"],
  ["climatology", "climate-science"],
  ["zoology", "biology"],
  ["ethology", "biology"],
  ["microbiology", "biology"],
  ["marine-biology", "biology"],
  ["evolutionary-biology", "biology"],
  ["biochemistry", "chemistry"],
  ["public-health", "epidemiology"],
  ["behavioral-science", "psychology"],
  ["behavioural-science", "psychology"],
  ["cognitive-science", "psychology"],
  ["cognitive-ethology", "psychology"],
  ["comparative-cognition", "psychology"],
  ["behavioral-economics", "economics"],
  ["comparative-politics", "political-science"],
  ["governance", "political-science"],
  ["government", "political-science"],
  ["jurisprudence", "law"],
]);

const domainTokenHints: Array<{ domain: string; tokens: string[] }> = [
  {
    domain: "astronomy",
    tokens: ["astronomy", "astrophysics", "planetary", "cosmology", "stellar", "exoplanet", "orbital"],
  },
  {
    domain: "artificial-intelligence",
    tokens: ["artificial-intelligence", "ai", "agentic", "multi-agent", "llm", "alignment"],
  },
  {
    domain: "machine-learning",
    tokens: ["machine-learning", "deep-learning", "reinforcement-learning", "neural", "transformer"],
  },
  {
    domain: "psychology",
    tokens: ["psychology", "cognitive", "cognition", "behavior", "behaviour", "comparative-cognition"],
  },
  {
    domain: "biology",
    tokens: ["biology", "ethology", "zoology", "animal", "evolutionary"],
  },
  {
    domain: "political-science",
    tokens: ["political", "politics", "governance", "government", "democracy", "state"],
  },
  {
    domain: "public-policy",
    tokens: ["policy", "policymaking"],
  },
  {
    domain: "law",
    tokens: ["law", "legal", "jurisprudence"],
  },
  {
    domain: "medicine",
    tokens: ["medicine", "medical", "clinical", "health"],
  },
  {
    domain: "epidemiology",
    tokens: ["epidemiology", "epidemic", "pandemic", "public-health"],
  },
  {
    domain: "physics",
    tokens: ["physics", "quantum", "relativity", "thermodynamics"],
  },
  {
    domain: "chemistry",
    tokens: ["chemistry", "chemical", "biochemistry"],
  },
  {
    domain: "earth-science",
    tokens: ["earth-science", "geology", "geophysics", "geoscience", "seismology"],
  },
  {
    domain: "climate-science",
    tokens: ["climate", "meteorology", "climatology"],
  },
  {
    domain: "economics",
    tokens: ["economics", "economic", "econometric", "market"],
  },
];

export function normalizeDomainSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isKnownDomain(domain: string | null | undefined): boolean {
  return typeof domain === "string" && canonicalDomainSet.has(domain);
}

export function isCalibratingDomain(domain: string | null | undefined): boolean {
  return domain === CALIBRATING_DOMAIN;
}

const slugContainsToken = (slug: string, token: string) =>
  slug === token ||
  slug.startsWith(`${token}-`) ||
  slug.endsWith(`-${token}`) ||
  slug.includes(`-${token}-`);

export function resolveCanonicalDomain(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;

  const normalized = normalizeDomainSlug(raw);
  if (!normalized) return null;
  if (normalized === CALIBRATING_DOMAIN) return CALIBRATING_DOMAIN;
  if (canonicalDomainSet.has(normalized)) return normalized;

  const directAlias = directDomainAliases.get(normalized);
  if (directAlias) return directAlias;

  let winner: string | null = null;
  let winnerScore = 0;

  for (const hint of domainTokenHints) {
    let score = 0;
    for (const token of hint.tokens) {
      if (slugContainsToken(normalized, token)) {
        score += token.includes("-") ? 3 : 2;
      }
    }
    if (score > winnerScore) {
      winner = hint.domain;
      winnerScore = score;
    }
  }

  return winner;
}

export function canonicalizeClaimDomain(
  raw: string | null | undefined,
  fallback: string = GENERAL_DOMAIN
): string {
  if (raw === CALIBRATING_DOMAIN) return CALIBRATING_DOMAIN;
  return resolveCanonicalDomain(raw) ?? fallback;
}

export function withCanonicalClaimDomain<T extends { domain: string }>(record: T): T {
  const domain = canonicalizeClaimDomain(record.domain);
  return domain === record.domain ? record : { ...record, domain };
}

export function formatDomainLabel(domain: string): string {
  if (domain === CALIBRATING_DOMAIN) return "Calibrating domain";
  const resolved = resolveCanonicalDomain(domain) ?? (normalizeDomainSlug(domain) || domain);
  return `d/${resolved}`;
}
