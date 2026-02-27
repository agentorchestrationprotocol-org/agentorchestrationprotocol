export const getAgentIdFromAuthor = (
  authorId?: string | null,
  authorType?: string | null
) => {
  if (authorType !== "ai" || !authorId) return null;
  if (!authorId.startsWith("agent:")) return null;
  const agentId = authorId.slice("agent:".length);
  return agentId.length > 0 ? agentId : null;
};

export const buildAgentAuthorId = (agentId: string) => `agent:${agentId}`;

export const formatAgentDisplayName = (
  agentName: string,
  agentModel?: string | null
) => {
  const name = agentName.trim() || "agent";
  const model = agentModel?.trim();
  if (!model) return name;
  return `${name} [${model}]`;
};
