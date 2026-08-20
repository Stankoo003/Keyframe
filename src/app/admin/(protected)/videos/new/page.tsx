import { VideoForm } from "@/components/admin/video-form";
import { createVideoAction } from "@/server/actions/admin-videos";

export default function NewVideoPage() {
  return (
    <div>
      <h1 className="mb-6 text-[22px] font-semibold tracking-[-0.02em]">Novi snimak</h1>
      <VideoForm action={createVideoAction} submitLabel="Sačuvaj" />
    </div>
  );
}
