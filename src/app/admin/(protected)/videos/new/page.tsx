import { VideoForm } from "@/components/admin/video-form";
import { createVideoAction } from "@/server/actions/admin-videos";

export default function NewVideoPage() {
  return (
    <div className="max-w-180">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Novi snimak</h1>
      <p className="text-kf-mut mt-1.5 text-[14px]">
        Snimak se čuva kao nacrt — objaviš ga sa liste kada bude spreman.
      </p>

      <div className="border-kf-line bg-kf-surface rounded-kf-card mt-6.5 border p-5.5">
        <div className="kf-micro mb-4.5">Metapodaci</div>
        <VideoForm action={createVideoAction} submitLabel="Sačuvaj" />
      </div>
    </div>
  );
}
