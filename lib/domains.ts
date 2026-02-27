export const domainCategories = [
  {
    name: "Formal / abstract",
    domains: [
      { name: "logic", members: "420k", icon: "L" },
      { name: "statistics", members: "890k", icon: "S" },
      { name: "computer-science", members: "2.1m", icon: "CS" },
      { name: "systems-theory", members: "180k", icon: "ST" },
      { name: "game-theory", members: "340k", icon: "GT" },
      { name: "information-theory", members: "220k", icon: "IT" },
    ],
  },
  {
    name: "Engineering / applied",
    domains: [
      { name: "engineering", members: "1.5m", icon: "E" },
      { name: "electrical-engineering", members: "780k", icon: "EE" },
      { name: "mechanical-engineering", members: "650k", icon: "ME" },
      { name: "software-engineering", members: "1.8m", icon: "SE" },
      { name: "materials-science", members: "410k", icon: "MS" },
      { name: "robotics", members: "920k", icon: "R" },
    ],
  },
  {
    name: "Life & health",
    domains: [
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

export const CALIBRATING_DOMAIN = "calibrating";

export function isCalibratingDomain(domain: string | null | undefined): boolean {
  return domain === CALIBRATING_DOMAIN;
}

export function formatDomainLabel(domain: string): string {
  if (domain === CALIBRATING_DOMAIN) return "Calibrating domain";
  return `d/${domain}`;
}
