import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = parseInt(tokenIdStr, 10);
  if (isNaN(tokenId) || tokenId < 0) {
    return new Response("Not found", { status: 404 });
  }

  const metadata = await convex.query(api.sbt.getMetadata, { tokenId });
  if (!metadata) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
