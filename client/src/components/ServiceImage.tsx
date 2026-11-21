import { useState } from "react";
import { Wrench } from "lucide-react";
import manifest from "../assets/service-images.json";
import { categories } from "../lib/marketplace";

const stockImages: Record<string, string> = {
  Plumbing: "plumbing", Electrical: "electrical", Cleaning: "cleaning", "House Cleaning": "cleaning",
  Painting: "painting", Beauty: "beauty", Hairdressing: "beauty", Gardening: "gardening",
  Carpentry: "carpentry", Handyman: "handyman", Tiling: "handyman", "Appliance Repair": "handyman",
  "Air Conditioning": "electrical", "Pest Control": "gardening", "Moving Services": "handyman", "Car Washing": "cleaning"
};
const categoryIllustrations: Record<string, string> = {
  Plumbing: "plumbing", Electrical: "electrical", Cleaning: "cleaning", "House Cleaning": "cleaning",
  Painting: "painting", Gardening: "gardening", Beauty: "beauty",
  "Appliance Repair": "appliance", Carpentry: "carpentry"
};

export default function ServiceImage({ category, image }: { category: string; image?: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const stock = `/images/${stockImages[category] || "handyman"}.jpg`;
  const supplied = image?.startsWith("/images/") || image?.startsWith("/uploads/") ? image : undefined;
  const illustration = categoryIllustrations[category];
  const sources = [supplied, (manifest.available as string[]).includes(stock) ? stock : undefined,
    illustration ? `/images/illustration-${illustration}.jpg` : undefined];
  const source = sources.find(path => path && !failed.includes(path));
  const style = categories.find(item => item.name === category);
  const Icon = style?.icon || Wrench;
  return <div className="service-photo">
    {source ? <img src={source} alt={source === supplied ? `${category} service` : `${category} category illustration`} loading="lazy" onError={() => setFailed(items => [...items, source])} /> :
      <div className={`photo-fallback category-art ${style?.color || "teal"}`} aria-hidden="true"><Icon size={82} strokeWidth={1.25} /></div>}
  </div>;
}
