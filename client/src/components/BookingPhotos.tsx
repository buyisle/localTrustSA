import { useEffect, useState } from "react";
import api from "../Services/api";

export default function BookingPhotos({ id, photos }: { id: string; photos: string[] }) {
  const [opened, setOpened] = useState(false);
  return <details onToggle={event => { if (event.currentTarget.open) setOpened(true); }}>
    <summary>Problem photos ({photos.length})</summary>
    {opened && <div className="booking-photo-grid">{photos.map((filename, index) =>
      <PrivatePhoto key={filename} path={`/bookings/${id}/photos/${encodeURIComponent(filename)}`} index={index} />
    )}</div>}
  </details>;
}

function PrivatePhoto({ path, index }: { path: string; index: number }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    api.get<Blob>(path, { responseType: "blob", signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(data);
      setUrl(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  if (failed) return <span>Photo unavailable</span>;
  if (!url) return <span role="status">Loading photo…</span>;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Problem photo ${index + 1}`} /></a>;
}
