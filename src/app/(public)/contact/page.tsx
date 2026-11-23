
import type { Metadata } from "next";
import { InfoPage } from "@/components/info";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact for RJNX Gaming Esports.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return <InfoPage section="contact" />;
}
