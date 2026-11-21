import { useState } from "react";
import type { Service } from "../types";

export default function ProviderAvatar({ provider }: { provider: Service["provider"] }) {
  const [failedPhoto, setFailedPhoto] = useState("");
  const photo = provider?.profilePhoto;
  const initials = provider?.name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join("").toUpperCase() || "LT";
  return <span className="provider-avatar" aria-hidden="true">
    {photo && photo !== failedPhoto ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedPhoto(photo)} /> : initials}
  </span>;
}
