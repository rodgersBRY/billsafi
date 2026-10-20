import s from "./landing.module.css";

/** The landing page's typographic BillSafi wordmark. */
export function Wordmark({ registered = false }: { registered?: boolean }) {
  return (
    <>
      <span className={s.brandIcon}>
        b<span>·</span>
      </span>
      bill<span className={s.logoLight}>safi</span>
      {registered && <span className={s.brandDot}>®</span>}
    </>
  );
}
