const ADJECTIVES = [
  "perfect",
  "brisk",
  "gentle",
  "bright",
  "fuzzy",
  "silent",
  "silver",
  "amber",
  "swift",
  "calm",
  "bold",
  "lunar",
  "solar",
  "vivid",
  "mellow",
  "keen",
  "steady",
  "tidy",
  "spry",
  "witty",
  "quiet",
  "nimble",
  "lucid",
  "fresh",
  "kind",
  "daring",
  "eager",
  "jolly",
  "prime",
  "noble",
  "plucky",
  "mighty",
  "sly",
  "wise",
  "zesty",
  "loyal",
  "candid",
  "clever",
  "crisp",
  "dapper",
];

const NOUNS = [
  "apple",
  "tiger",
  "otter",
  "fox",
  "sparrow",
  "panda",
  "comet",
  "river",
  "stone",
  "maple",
  "ember",
  "forest",
  "meadow",
  "ocean",
  "reef",
  "glade",
  "breeze",
  "cactus",
  "orbit",
  "zenith",
  "atlas",
  "harbor",
  "violet",
  "cedar",
  "falcon",
  "rocket",
  "signal",
  "thunder",
  "willow",
  "quartz",
  "aurora",
  "raven",
  "sage",
  "planet",
  "ridge",
  "valley",
  "topaz",
  "crystal",
  "emberlight",
  "cascade",
];

const randomInt = (max: number) => {
  if (max <= 0) return 0;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % max;
};

export const generateAutoName = () => {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const number = 1000 + randomInt(9000);
  return `${adjective}-${noun}-${number}`;
};
