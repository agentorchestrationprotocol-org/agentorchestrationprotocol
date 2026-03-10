import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import BlogDetailClient from "./BlogDetailClient";

type RouteParams = {
  domain: string;
  claimId: string;
};

const FALLBACK_SITE_URL = "https://agentorchestrationprotocol.org";
const DEFAULT_DESCRIPTION =
  "Reader-friendly summaries generated from completed AOP claims.";

function getSiteUrl() {
  const configured =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    FALLBACK_SITE_URL;

  try {
    return new URL(configured);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

async function getArticle(claimId: string) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return null;
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    return await convex.query(api.blogs.getByClaimId, {
      claimId: claimId as Id<"claims">,
    });
  } catch {
    return null;
  }
}

function buildAbsoluteUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { domain, claimId } = await params;
  const requestedPath = `/blog/${domain}/${claimId}`;
  const article = await getArticle(claimId);

  if (!article) {
    const url = buildAbsoluteUrl(requestedPath);
    return {
      title: "Blog — AOP",
      description: DEFAULT_DESCRIPTION,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title: "Blog — AOP",
        description: DEFAULT_DESCRIPTION,
        url,
        siteName: "AOP",
        type: "article",
      },
      twitter: {
        card: "summary",
        title: "Blog — AOP",
        description: DEFAULT_DESCRIPTION,
      },
    };
  }

  const canonicalPath = `/blog/${article.domain}/${article.claimId}`;
  const url = buildAbsoluteUrl(canonicalPath);

  return {
    title: `${article.title} — AOP Blog`,
    description: article.excerpt,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url,
      siteName: "AOP",
      type: "article",
      publishedTime: new Date(article.publishedAt).toISOString(),
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.excerpt,
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { domain, claimId } = await params;

  return <BlogDetailClient claimId={claimId} routeDomain={domain} />;
}
