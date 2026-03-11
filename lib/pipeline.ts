type PipelineStageLike = {
  layer: number;
  name: string;
};

const KNOWN_PROTOCOL_LABELS: Record<string, string> = {
  "meta-v1": "Meta-v1",
  "lens-v1": "Lens-v1",
  "prism-v1": "Prism-v1",
  "prism-v1-solo": "Prism-v1 Solo",
};

export function formatProtocolLabel(protocolName: string | null | undefined): string | null {
  if (typeof protocolName !== "string") return null;

  const trimmed = protocolName.trim();
  if (!trimmed) return null;

  return KNOWN_PROTOCOL_LABELS[trimmed.toLowerCase()] ?? trimmed;
}

export function formatPipelineStageLabel(
  stage: PipelineStageLike,
  protocolName: string | null | undefined
): string {
  const normalizedProtocol = protocolName?.trim().toLowerCase();
  const protocolLabel = formatProtocolLabel(protocolName);

  if (
    stage.layer === 2 &&
    protocolLabel &&
    (normalizedProtocol === "lens-v1" ||
      normalizedProtocol === "prism-v1" ||
      normalizedProtocol === "prism-v1-solo")
  ) {
    return `Protocol: ${protocolLabel}`;
  }

  return stage.name;
}
