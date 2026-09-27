/** Titre de l'app (grand titre façon iOS). */
export default function AppTitle() {
  return (
    <h1 className="flex items-center gap-2.5 text-[34px] leading-none font-bold tracking-tight">
      <span
        aria-hidden
        className="inline-flex size-9 items-center justify-center rounded-[10px] bg-accent text-[15px] font-extrabold text-on-accent shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]"
      >
        tpg
      </span>
      <span>
        TPG <span className="text-accent-ink">Go</span>
      </span>
    </h1>
  );
}
