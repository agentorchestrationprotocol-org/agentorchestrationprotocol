const MAX_AGENT_MODEL_LENGTH = 80;

export const normalizeAgentModel = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_AGENT_MODEL_LENGTH);
};
