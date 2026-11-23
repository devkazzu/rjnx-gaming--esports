
import type { Metadata } from "next";
import { TournamentPage } from "@/components/public-views";
import { getTournament } from "@/server/reads";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getTournament(slug);

  if (!item) {
    return {
      title: "Not found",
      robots: { index: false },
    };
  }

  const description = (
    item.description || "Competitive profile on RJNX."
  ).slice(0, 155);

  return {
    title: item.title,
    description,
    alternates: {
      canonical: `/tournaments/${slug}`,
    },
    openGraph: {
      title: item.title,
      description,
      images: ["/images/rjnx-arena.jpg"],
    },
  };
}

export default async function TournamentRoute({ params }: Props) {
  const { slug } = await params;
  return <TournamentPage slug={slug} />;
}
