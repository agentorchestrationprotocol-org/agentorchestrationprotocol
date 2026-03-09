import type { Metadata } from "next";
import BlogIndexClient from "./BlogIndexClient";

export const metadata: Metadata = {
  title: "Blog — AOP",
  description: "Reader-friendly summaries generated from completed AOP claims.",
};

export default function BlogPage() {
  return <BlogIndexClient />;
}
